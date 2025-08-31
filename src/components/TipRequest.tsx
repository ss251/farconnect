'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Wallet, ConnectWallet } from '@coinbase/onchainkit/wallet';
import { 
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusLabel,
  TransactionStatusAction,
  type LifecycleStatus
} from '@coinbase/onchainkit/transaction';
import { base } from 'wagmi/chains';
import { encodeFunctionData } from 'viem';

// USDC contract address on Base
const USDC_ADDRESS_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;

interface TipRequestProps {
  senderName?: string;
  senderAvatar?: string;
  requestedAmount?: string;
  message?: string;
  recipientAddress?: string;
  onClose?: () => void;
}

export function TipRequest({ 
  senderName = 'Anonymous',
  senderAvatar,
  requestedAmount = '1',
  message = 'Tips appreciated! 🙏',
  recipientAddress,
  onClose
}: TipRequestProps) {
  const { isConnected } = useAccount();
  const [isProcessing, setIsProcessing] = useState(false);
  const [txSuccess, setTxSuccess] = useState(false);

  // If no recipient address provided, this is a preview
  const isPreview = !recipientAddress;

  // Convert USDC amount to smallest unit (6 decimals)
  const amountInSmallestUnit = BigInt(parseFloat(requestedAmount) * 10 ** USDC_DECIMALS);

  // USDC transfer ABI
  const usdcAbi = [
    {
      name: 'transfer',
      type: 'function',
      stateMutability: 'nonpayable',
      inputs: [
        { name: 'to', type: 'address' },
        { name: 'amount', type: 'uint256' }
      ],
      outputs: [{ type: 'bool' }]
    }
  ] as const;

  const calls = recipientAddress ? [
    {
      to: USDC_ADDRESS_BASE as `0x${string}`,
      value: 0n,
      data: encodeFunctionData({
        abi: usdcAbi,
        functionName: 'transfer',
        args: [recipientAddress as `0x${string}`, amountInSmallestUnit],
      }),
    }
  ] : [];

  if (!isConnected && !isPreview) {
    return (
      <div className="p-4 elevation-2 rounded-xl border border-white/5 max-w-sm">
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-400">Connect wallet to send tip</p>
          <Wallet>
            <ConnectWallet className="w-full bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg">
              <span>Connect Wallet</span>
            </ConnectWallet>
          </Wallet>
        </div>
      </div>
    );
  }

  if (txSuccess) {
    return (
      <div className="p-4 elevation-2 rounded-xl border border-white/5 max-w-sm">
        <div className="text-center space-y-3">
          <div className="text-4xl">✅</div>
          <p className="text-white font-medium">Tip sent successfully!</p>
          <p className="text-sm text-gray-400">{requestedAmount} USDC sent to {senderName}</p>
          {onClose && (
            <button onClick={onClose} className="text-sm text-primary hover:text-primary-light">
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 elevation-2 rounded-xl border border-white/5 max-w-sm space-y-4">
      {/* Header with user info */}
      <div className="flex items-center gap-3">
        {senderAvatar ? (
          <img src={senderAvatar} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
            <span className="text-sm">{senderName[0]?.toUpperCase()}</span>
          </div>
        )}
        <div className="flex-1">
          <p className="font-medium text-white">{senderName}</p>
          <p className="text-xs text-gray-400">Requesting a tip</p>
        </div>
      </div>

      {/* Amount display */}
      <div className="bg-gray-800/50 rounded-lg p-4 text-center">
        <p className="text-3xl font-bold text-white">{requestedAmount} USDC</p>
        <p className="text-sm text-gray-400 mt-1">on Base</p>
      </div>

      {/* Message */}
      {message && (
        <div className="bg-gray-800/30 rounded-lg p-3">
          <p className="text-sm text-gray-300">{message}</p>
        </div>
      )}

      {/* Action button */}
      {!isPreview && recipientAddress && (
        <Transaction
          chainId={base.id}
          calls={calls}
          onStatus={(status: LifecycleStatus) => {
            setIsProcessing(status.statusName === 'transactionPending');
            if (status.statusName === 'success') {
              setTxSuccess(true);
            }
          }}
        >
          <TransactionButton 
            className="w-full bg-primary hover:bg-primary-dark text-white px-4 py-3 rounded-lg font-medium disabled:opacity-50"
            disabled={isProcessing}
            text={isProcessing ? 'Sending...' : `Send ${requestedAmount} USDC`}
          />
          <TransactionStatus>
            <TransactionStatusLabel className="text-xs text-gray-400 mt-2 text-center" />
            <TransactionStatusAction className="text-xs text-primary hover:text-primary-light mt-1 text-center" />
          </TransactionStatus>
        </Transaction>
      )}

      {/* Preview mode */}
      {isPreview && (
        <div className="text-center text-xs text-gray-500">
          Preview mode - Share this to receive tips
        </div>
      )}
    </div>
  );
}