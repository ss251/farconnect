'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Wallet, ConnectWallet } from '@coinbase/onchainkit/wallet';
import { 
  Transaction,
  TransactionButton,
  TransactionStatus,
  TransactionStatusLabel,
  type LifecycleStatus
} from '@coinbase/onchainkit/transaction';
import { base } from 'wagmi/chains';
import { encodeFunctionData } from 'viem';

// USDC contract address on Base
const USDC_ADDRESS_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_DECIMALS = 6;

interface TipRequestMessageProps {
  amount: string;
  recipientAddress?: string;
  recipientName: string;
  recipientAvatar?: string;
  note?: string;
  isOwnMessage: boolean;
}

export function TipRequestMessage({ 
  amount,
  recipientAddress,
  recipientName,
  recipientAvatar,
  note,
  isOwnMessage
}: TipRequestMessageProps) {
  const { address, isConnected } = useAccount();
  const [hasSent, setHasSent] = useState(false);
  const [showConnect, setShowConnect] = useState(false);

  // Convert USDC amount to smallest unit (6 decimals)
  const amountInSmallestUnit = BigInt(parseFloat(amount) * 10 ** USDC_DECIMALS);

  // Use the connected wallet address as recipient if this is own message
  const targetAddress = isOwnMessage ? address : recipientAddress;

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

  const calls = targetAddress ? [
    {
      to: USDC_ADDRESS_BASE as `0x${string}`,
      value: 0n,
      data: encodeFunctionData({
        abi: usdcAbi,
        functionName: 'transfer',
        args: [targetAddress as `0x${string}`, amountInSmallestUnit],
      }),
    }
  ] : [];

  if (hasSent) {
    return (
      <div className="inline-block">
        <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-4 max-w-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <span className="text-xl">✅</span>
            </div>
            <div className="flex-1">
              <p className="text-sm text-green-400 font-medium">Tip Sent!</p>
              <p className="text-xs text-gray-400">{amount} USDC to {recipientName}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If it's your own request, show who can pay you
  if (isOwnMessage) {
    return (
      <div className="inline-block">
        <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 max-w-xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xl">💰</span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Requesting {amount} USDC</p>
                {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
                {address && (
                  <p className="text-xs text-gray-500 mt-1 truncate max-w-[150px]">
                    To: {address}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-400 text-center">
            Others can tap to send you USDC
          </div>
        </div>
      </div>
    );
  }

  // For others' requests, show pay button
  if (showConnect && !isConnected) {
    return (
      <div className="inline-block">
        <div className="bg-gray-800 border border-white/10 rounded-2xl p-4 max-w-xs">
          <p className="text-sm text-gray-400 mb-3">Connect wallet to send tip</p>
          <Wallet>
            <ConnectWallet className="w-full bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm">
              <span>Connect Wallet</span>
            </ConnectWallet>
          </Wallet>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-block">
      <div className="bg-gray-800 border border-white/10 rounded-2xl p-4 max-w-xs hover:border-primary/50 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="text-xl">💸</span>
            </div>
            <div>
              <p className="text-sm font-medium text-white">{recipientName} requests</p>
              <p className="text-lg font-bold text-primary">{amount} USDC</p>
              {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
            </div>
          </div>
        </div>

        {!isConnected ? (
          <button
            onClick={() => setShowConnect(true)}
            className="w-full mt-3 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Send {amount} USDC
          </button>
        ) : targetAddress ? (
          <Transaction
            chainId={base.id}
            calls={calls}
            onStatus={(status: LifecycleStatus) => {
              if (status.statusName === 'success') {
                setHasSent(true);
              }
            }}
          >
            <TransactionButton 
              className="w-full mt-3 bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              text={`Send ${amount} USDC`}
            />
            <TransactionStatus>
              <TransactionStatusLabel className="text-xs text-gray-400 mt-1 text-center" />
            </TransactionStatus>
          </Transaction>
        ) : (
          <div className="mt-3 text-xs text-gray-500 text-center">
            Recipient wallet not available
          </div>
        )}
      </div>
    </div>
  );
}