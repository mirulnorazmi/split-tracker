import React from 'react';
import { APP_NAME } from '@/lib/constants';

interface LoadingScreenProps {
  text?: string;
  fullScreen?: boolean;
}

export default function LoadingScreen({
  text = '',
  fullScreen = false,
}: LoadingScreenProps) {
  return (
    <div
      className={
        fullScreen
          ? 'splittrack-loader-container'
          : 'py-20 min-h-[55vh] w-full flex flex-col items-center justify-center select-none'
      }
    >
      <div className="splittrack-loader-logo-wrap">
        <div className="splittrack-loader-aura" />
        <img
          src="/logo.webp"
          alt={APP_NAME}
          className="splittrack-loader-logo"
          width="56"
          height="56"
        />
      </div>

      <div className="splittrack-loader-status">
        <svg
          className="splittrack-loader-spinner"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle
            cx="12"
            cy="12"
            r="9.5"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="2.5"
          />
          <circle
            cx="12"
            cy="12"
            r="9.5"
            stroke="#C9FF55"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="16 44"
          />
        </svg>
        {text ? <span className="splittrack-loader-text">{text}</span> : null}
      </div>
    </div>
  );
}

