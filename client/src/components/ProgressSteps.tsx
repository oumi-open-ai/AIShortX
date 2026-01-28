/**
 * 进度步骤组件
 * 用于显示AI处理任务的进度状态
 */
import React from 'react';
import { CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons';

export type StepStatus = 'pending' | 'loading' | 'completed' | 'error';

export interface ProgressStep {
  key: string;
  label: string;
  status: StepStatus;
  progress: number;
  showWaiting?: boolean;
}

interface ProgressStepsProps {
  steps: ProgressStep[];
  title?: string;
}

export const ProgressSteps: React.FC<ProgressStepsProps> = ({ steps, title = 'AI 正在处理' }) => {
  return (
    <div className="h-[550px] flex flex-col items-center justify-center animate-fade-in px-12 py-8">
      <div className="relative w-20 h-20 mb-6">
        <div className="absolute inset-0 border-4 border-primary/20 rounded-full animate-ping-slow"></div>
        <div className="absolute inset-2 border-4 border-t-primary border-r-primary border-b-transparent border-l-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-10 h-10 text-primary animate-pulse"
          >
            <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" />
          </svg>
        </div>
      </div>
      <h3 className="text-lg font-medium text-text-primary mb-8">
        {title}
      </h3>

      <div className="w-80 space-y-2">
        {steps.map((step) => {
          const isActive = step.status === 'loading';
          const isCompleted = step.status === 'completed';
          const isPending = step.status === 'pending';
          const isError = step.status === 'error';

          return (
            <div
              key={step.key}
              className={`rounded-lg px-4 py-2.5 transition-all duration-500 ease-out ${
                isActive ? 'bg-gradient-to-r from-primary/20 to-primary/10 border border-primary/30 scale-110' :
                isCompleted ? 'bg-green-500/10 border border-green-500/20 scale-100' :
                isError ? 'bg-orange-500/10 border border-orange-500/20 scale-100' :
                'bg-white/5 border border-white/10 scale-100'
              }`}
              style={{ transformOrigin: 'center' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`font-medium transition-all duration-500 ${
                    isCompleted ? 'text-green-500 text-sm' :
                    isError ? 'text-orange-500 text-sm' :
                    isActive ? 'text-primary text-base' :
                    'text-text-secondary/60 text-sm'
                  }`}>
                    {step.label}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {step.showWaiting && isActive && (
                    <span className="text-xs text-primary/80 animate-pulse">
                      正在分析中...
                    </span>
                  )}

                  {isActive ? (
                    <span className="text-primary text-base font-bold min-w-[50px] text-right transition-all duration-500">
                      {Math.round(step.progress)}%
                    </span>
                  ) : isCompleted ? (
                    <CheckCircleFilled className="text-base text-green-500 transition-all duration-300" style={{ color: '#24B340' }} />
                  ) : isError ? (
                    <ExclamationCircleFilled className="text-base text-orange-500 transition-all duration-300" style={{ color: '#FF8C00' }} />
                  ) : isPending ? (
                    <span className="text-text-secondary/40 text-xs transition-all duration-500">
                      等待中
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
