import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-center">
          <div className="bg-red-500/10 rounded-2xl p-6 ring-1 ring-red-500/20">
            <p className="text-red-400 font-bold mb-2">Что-то пошло не так</p>
            <p className="text-red-300/70 text-xs mb-4">{this.state.error.message}</p>
            <button onClick={() => this.setState({ error: null })}
              className="bg-red-500 text-white px-6 py-2 rounded-xl text-sm font-semibold">
              Попробовать снова
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
