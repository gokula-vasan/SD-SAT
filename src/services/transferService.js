const { ObjectId } = require('mongodb');
const { getClient } = require('../config/db');
const accountRepository = require('../repositories/accountRepository');
const transferRepository = require('../repositories/transferRepository');
const ledgerRepository = require('../repositories/ledgerRepository');
const notificationRepository = require('../repositories/notificationRepository');
const auditRepository = require('../repositories/auditRepository');
const userRepository = require('../repositories/userRepository');
const { generateTransferReference, formatPaiseToRupees } = require('../utils/formatters');

class TransferService {
  async executeTransfer({
    senderUser,
    senderAccount,
    recipientAccountNumber,
    amountInPaise,
    description,
    idempotencyKey,
  }) {
    // 1. Idempotency Check
    const existingTransfer = await transferRepository.findByIdempotencyKey(
      senderAccount.id,
      idempotencyKey
    );

    if (existingTransfer) {
      // Fetch recipient account to check if parameters match
      const existingRecipient = await accountRepository.findById(existingTransfer.recipientAccountId);
      const isParamMatch =
        existingTransfer.amountInPaise === amountInPaise &&
        existingRecipient &&
        existingRecipient.accountNumber === recipientAccountNumber;

      if (!isParamMatch) {
        const error = new Error('Idempotency conflict: Key was previously used with different transfer parameters.');
        error.statusCode = 409;
        error.isOperational = true;
        throw error;
      }

      // Replay existing idempotent response
      return {
        idempotentReplay: true,
        transfer: {
          id: existingTransfer._id.toString(),
          reference: existingTransfer.reference,
          amountInPaise: existingTransfer.amountInPaise,
          amountFormatted: formatPaiseToRupees(existingTransfer.amountInPaise),
          status: existingTransfer.status,
          recipientAccountNumber,
          description: existingTransfer.description,
          initiatedAt: existingTransfer.initiatedAt,
          completedAt: existingTransfer.completedAt,
        },
        message: `Transfer already processed (Reference: ${existingTransfer.reference}).`,
      };
    }

    // 2. Validate sender account status and balance
    const currentSenderAccount = await accountRepository.findById(senderAccount.id);
    if (!currentSenderAccount || currentSenderAccount.status !== 'active') {
      const error = new Error('Sender account is not active or not found.');
      error.statusCode = 400;
      error.isOperational = true;
      throw error;
    }

    if (currentSenderAccount.balanceInPaise < amountInPaise) {
      // Audit log failed attempt
      await auditRepository.log({
        actorUserId: senderUser._id,
        action: 'TRANSFER_FAILED',
        entityType: 'transfer',
        entityId: null,
        metadata: {
          reason: 'Insufficient balance',
          attemptedAmountInPaise: amountInPaise,
          availableBalanceInPaise: currentSenderAccount.balanceInPaise,
        },
      });

      const error = new Error(
        `Insufficient funds. Available balance: ${formatPaiseToRupees(
          currentSenderAccount.balanceInPaise
        )}, transfer amount: ${formatPaiseToRupees(amountInPaise)}.`
      );
      error.statusCode = 400;
      error.isOperational = true;
      throw error;
    }

    // 3. Validate recipient account
    const recipientAccount = await accountRepository.findByAccountNumber(recipientAccountNumber);
    if (!recipientAccount) {
      const error = new Error(`Recipient account "${recipientAccountNumber}" does not exist.`);
      error.statusCode = 404;
      error.isOperational = true;
      throw error;
    }

    if (recipientAccount._id.equals(currentSenderAccount._id)) {
      const error = new Error('Cannot transfer money to your own account.');
      error.statusCode = 400;
      error.isOperational = true;
      throw error;
    }

    if (recipientAccount.status !== 'active') {
      const error = new Error('Recipient account is currently inactive or suspended.');
      error.statusCode = 400;
      error.isOperational = true;
      throw error;
    }

    // 4. Begin Multi-Document MongoDB Transaction
    const client = getClient();
    const session = client.startSession();
    const reference = generateTransferReference();
    let transferRecord = null;

    try {
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority' },
      });

      // Step A: Insert transfer record with status 'pending'
      transferRecord = await transferRepository.create(
        {
          reference,
          senderAccountId: currentSenderAccount._id,
          recipientAccountId: recipientAccount._id,
          amountInPaise,
          description,
          status: 'pending',
          idempotencyKey,
          initiatedAt: new Date(),
        },
        { session }
      );

      // Step B: Atomic conditional debit on sender account
      const debitResult = await accountRepository.debitConditional(
        currentSenderAccount._id,
        amountInPaise,
        session
      );
      const debitDoc = debitResult && debitResult.value ? debitResult.value : debitResult;
      if (!debitDoc) {
        throw new Error('Debit failed: Insufficient balance or account became inactive concurrently.');
      }

      // Step C: Atomic credit on recipient account
      const creditResult = await accountRepository.credit(
        recipientAccount._id,
        amountInPaise,
        session
      );
      const creditDoc = creditResult && creditResult.value ? creditResult.value : creditResult;
      if (!creditDoc) {
        throw new Error('Credit failed: Recipient account became inactive concurrently.');
      }

      // Step D: Record immutable double-entry ledger entries
      await ledgerRepository.createEntries(
        [
          {
            transferId: transferRecord._id,
            accountId: currentSenderAccount._id,
            entryType: 'debit',
            amountInPaise,
          },
          {
            transferId: transferRecord._id,
            accountId: recipientAccount._id,
            entryType: 'credit',
            amountInPaise,
          },
        ],
        session
      );

      // Step E: Update transfer record to 'completed'
      await transferRepository.updateStatus(transferRecord._id, 'completed', null, session);

      // Step F: Commit transaction
      await session.commitTransaction();
    } catch (txError) {
      await session.abortTransaction();

      // Log failure in audit log
      await auditRepository.log({
        actorUserId: senderUser._id,
        action: 'TRANSFER_FAILED',
        entityType: 'transfer',
        entityId: transferRecord ? transferRecord._id : null,
        metadata: {
          reference,
          recipientAccountNumber,
          amountInPaise,
          error: txError.message,
        },
      });

      // Notification for sender on failed transfer
      await notificationRepository.create({
        userId: senderUser._id,
        type: 'TRANSFER_FAILED',
        message: `Transfer of ${formatPaiseToRupees(amountInPaise)} to ${recipientAccountNumber} failed: ${txError.message}`,
        relatedTransferId: null,
      });

      const err = new Error(txError.message || 'Money transfer failed and all changes were rolled back.');
      err.statusCode = txError.statusCode || 400;
      err.isOperational = true;
      throw err;
    } finally {
      await session.endSession();
    }

    // 5. Post-Commit Actions (Notifications & Audit Logs)
    try {
      // Find recipient user for notification
      const recipientUser = await userRepository.findById(recipientAccount.userId);

      // Notification to Sender
      await notificationRepository.create({
        userId: senderUser._id,
        type: 'TRANSFER_SENT',
        message: `Successfully transferred ${formatPaiseToRupees(amountInPaise)} to account ${recipientAccount.accountNumber}. Ref: ${reference}`,
        relatedTransferId: transferRecord._id,
      });

      // Notification to Recipient
      if (recipientUser) {
        await notificationRepository.create({
          userId: recipientUser._id,
          type: 'TRANSFER_RECEIVED',
          message: `Received ${formatPaiseToRupees(amountInPaise)} from account ${currentSenderAccount.accountNumber}. Ref: ${reference}`,
          relatedTransferId: transferRecord._id,
        });
      }

      // Audit Log for completed transfer
      await auditRepository.log({
        actorUserId: senderUser._id,
        action: 'TRANSFER_COMPLETED',
        entityType: 'transfer',
        entityId: transferRecord._id,
        metadata: {
          reference,
          senderAccountNumber: currentSenderAccount.accountNumber,
          recipientAccountNumber: recipientAccount.accountNumber,
          amountInPaise,
        },
      });
    } catch (postCommitErr) {
      console.error('[POST-COMMIT ERROR]', postCommitErr);
    }

    // Fetch updated balance of sender
    const updatedSenderAccount = await accountRepository.findById(currentSenderAccount._id);

    return {
      success: true,
      transfer: {
        id: transferRecord._id.toString(),
        reference,
        amountInPaise,
        amountFormatted: formatPaiseToRupees(amountInPaise),
        status: 'completed',
        recipientAccountNumber: recipientAccount.accountNumber,
        description,
        initiatedAt: transferRecord.initiatedAt,
        completedAt: new Date(),
      },
      newBalanceFormatted: formatPaiseToRupees(updatedSenderAccount ? updatedSenderAccount.balanceInPaise : 0),
      message: `Successfully transferred ${formatPaiseToRupees(amountInPaise)} to ${recipientAccount.accountNumber}.`,
    };
  }

  async getTransferById(transferId, userAccount) {
    const transfer = await transferRepository.findById(transferId);
    if (!transfer) {
      const error = new Error('Transfer not found.');
      error.statusCode = 404;
      error.isOperational = true;
      throw error;
    }

    // Authorization check: must be sender, recipient, or admin
    const isSender = transfer.senderAccountId.equals(userAccount._id);
    const isRecipient = transfer.recipientAccountId.equals(userAccount._id);

    if (!isSender && !isRecipient) {
      const error = new Error('You are not authorized to view this transfer.');
      error.statusCode = 403;
      error.isOperational = true;
      throw error;
    }

    const senderAcc = await accountRepository.findById(transfer.senderAccountId);
    const recipientAcc = await accountRepository.findById(transfer.recipientAccountId);

    return {
      id: transfer._id.toString(),
      reference: transfer.reference,
      amountInPaise: transfer.amountInPaise,
      amountFormatted: formatPaiseToRupees(transfer.amountInPaise),
      senderAccountNumber: senderAcc ? senderAcc.accountNumber : 'UNKNOWN',
      recipientAccountNumber: recipientAcc ? recipientAcc.accountNumber : 'UNKNOWN',
      type: isSender ? 'debit' : 'credit',
      status: transfer.status,
      description: transfer.description,
      initiatedAt: transfer.initiatedAt,
      completedAt: transfer.completedAt,
    };
  }

  async getTransferByReference(reference, userAccount) {
    const transfer = await transferRepository.findByReference(reference);
    if (!transfer) {
      const error = new Error('Transfer with reference not found.');
      error.statusCode = 404;
      error.isOperational = true;
      throw error;
    }
    return this.getTransferById(transfer._id, userAccount);
  }
}

module.exports = new TransferService();
