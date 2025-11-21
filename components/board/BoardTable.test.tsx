import { render, screen } from '@testing-library/react';
import { BoardTable } from './BoardTable';

describe('BoardTable', () => {
  it('should render the board table', () => {
    render(<BoardTable boardId="123" />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
