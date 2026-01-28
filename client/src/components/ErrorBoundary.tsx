/**
 * 错误边界组件
 * 捕获React组件树中的错误并显示友好的错误页面
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result, Typography } from 'antd';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '50px', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#141414' }}>
          <Result
            status="error"
            title="Something went wrong"
            subTitle={this.state.error?.message || 'An unexpected error occurred.'}
            extra={[
              <div key="error-details" style={{ textAlign: 'left', marginBottom: '20px', maxHeight: '200px', overflow: 'auto', backgroundColor: '#1f1f1f', padding: '10px', borderRadius: '4px' }}>
                <Typography.Text type="danger" code>
                  {this.state.error?.stack}
                </Typography.Text>
              </div>,
              <Button type="primary" key="reload" onClick={() => window.location.reload()}>
                Reload Page
              </Button>
            ]}
          />
        </div>
      );
    }

    return this.props.children;
  }
}
