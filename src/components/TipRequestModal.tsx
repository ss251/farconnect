'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';

interface TipRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (amount: string, note: string) => void;
}

export function TipRequestModal({ isOpen, onClose, onSend }: TipRequestModalProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const { address } = useAccount();

  if (!isOpen) return null;

  const handleSend = () => {
    if (!amount || parseFloat(amount) <= 0) return;
    onSend(amount, note);
    setAmount('');
    setNote('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:elevation-2 rounded-2xl p-6 max-w-sm w-full">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Request USDC Tip
        </h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount (USDC)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1.00"
              className="w-full px-4 py-2 bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg text-black dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Thanks for the help!"
              maxLength={100}
              className="w-full px-4 py-2 bg-gray-100 dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg text-black dark:text-white"
            />
          </div>

          {!address && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Connect your wallet to receive tips
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-white/10 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-white/20 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!amount || parseFloat(amount) <= 0}
            className="flex-1 px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
}