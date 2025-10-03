import React from 'react';
import { render } from '@testing-library/react';
import CommonHeader from './common-header';

test('renders common header', () => {
  const { getByText } = render(<CommonHeader />);
  const linkElement = getByText(/common header/i);
  expect(linkElement).toBeInTheDocument();
});