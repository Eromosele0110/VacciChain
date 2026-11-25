import { render, screen, act } from '@testing-library/react';
import AnalyticsDashboard from './AnalyticsDashboard';

jest.mock('../hooks/useFreighter', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../hooks/useFreighter';

const mockRates = { rates: [{ vaccine_name: 'COVID-19', count: 120 }, { vaccine_name: 'Flu', count: 80 }] };
const mockIssuers = { issuers: [{ address: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ', count: 50, last_active: '2024-01-15T10:00:00Z' }] };
const mockAnomalies = { anomalies: [] };

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = jest.fn().mockImplementation((url) => {
    if (url.includes('/analytics/rates')) return Promise.resolve({ json: () => Promise.resolve(mockRates) });
    if (url.includes('/analytics/issuers')) return Promise.resolve({ json: () => Promise.resolve(mockIssuers) });
    if (url.includes('/analytics/anomalies')) return Promise.resolve({ json: () => Promise.resolve(mockAnomalies) });
    return Promise.reject(new Error('Unknown URL'));
  });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AnalyticsDashboard', () => {
  it('shows access-restricted message for non-issuers', () => {
    useAuth.mockReturnValue({ role: 'patient', apiFetch: jest.fn() });
    render(<AnalyticsDashboard />);
    expect(screen.getByText(/Access restricted to authorized issuers/i)).toBeInTheDocument();
  });

  it('renders dashboard heading for issuers', async () => {
    useAuth.mockReturnValue({ role: 'issuer', apiFetch: jest.fn() });
    await act(async () => { render(<AnalyticsDashboard />); });
    expect(screen.getByText(/Analytics Dashboard/i)).toBeInTheDocument();
  });

  it('renders vaccination rates section', async () => {
    useAuth.mockReturnValue({ role: 'issuer', apiFetch: jest.fn() });
    await act(async () => { render(<AnalyticsDashboard />); });
    expect(screen.getByText(/Vaccination Rates by Vaccine Type/i)).toBeInTheDocument();
  });

  it('renders issuer activity section', async () => {
    useAuth.mockReturnValue({ role: 'issuer', apiFetch: jest.fn() });
    await act(async () => { render(<AnalyticsDashboard />); });
    expect(screen.getByText(/Issuer Activity/i)).toBeInTheDocument();
  });

  it('renders anomaly flags section', async () => {
    useAuth.mockReturnValue({ role: 'issuer', apiFetch: jest.fn() });
    await act(async () => { render(<AnalyticsDashboard />); });
    expect(screen.getByText(/Anomaly Flags/i)).toBeInTheDocument();
  });

  it('shows no anomalies message when list is empty', async () => {
    useAuth.mockReturnValue({ role: 'issuer', apiFetch: jest.fn() });
    await act(async () => { render(<AnalyticsDashboard />); });
    expect(screen.getByText(/No anomalies detected/i)).toBeInTheDocument();
  });

  it('shows vaccine names in bar chart', async () => {
    useAuth.mockReturnValue({ role: 'issuer', apiFetch: jest.fn() });
    await act(async () => { render(<AnalyticsDashboard />); });
    expect(screen.getByText('COVID-19')).toBeInTheDocument();
    expect(screen.getByText('Flu')).toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
    useAuth.mockReturnValue({ role: 'issuer', apiFetch: jest.fn() });
    await act(async () => { render(<AnalyticsDashboard />); });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('auto-refreshes after 60 seconds', async () => {
    useAuth.mockReturnValue({ role: 'issuer', apiFetch: jest.fn() });
    await act(async () => { render(<AnalyticsDashboard />); });
    const callsBefore = global.fetch.mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(global.fetch.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('shows anomaly severity badge when anomalies exist', async () => {
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/analytics/rates')) return Promise.resolve({ json: () => Promise.resolve(mockRates) });
      if (url.includes('/analytics/issuers')) return Promise.resolve({ json: () => Promise.resolve(mockIssuers) });
      if (url.includes('/analytics/anomalies')) return Promise.resolve({
        json: () => Promise.resolve({ anomalies: [{ issuer: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVWXYZ', count: 200, severity: 'high', reason: 'Spike detected' }] }),
      });
      return Promise.reject(new Error('Unknown URL'));
    });
    useAuth.mockReturnValue({ role: 'issuer', apiFetch: jest.fn() });
    await act(async () => { render(<AnalyticsDashboard />); });
    expect(screen.getByText('high')).toBeInTheDocument();
    expect(screen.getByText('Spike detected')).toBeInTheDocument();
  });

  const serve = (bodies) => {
    useAuth.mockReturnValue({ role: 'issuer' });
    global.fetch = jest.fn((url) => Promise.resolve({ ok: true, json: () => Promise.resolve(bodies[url.split('/').pop()]) }));
  };

  it('reads the analytics service shape and gives charts names and a table', async () => {
    serve({
      rates: { rates: { Flu: 0, MMR: 5 }, total_mints: 5 },
      issuers: { issuers: [{ issuer: 'GABCDEFGHIJKLMNOP', total_issued: 5, last_ledger: 9 }] },
      anomalies: { flagged_issuers: [{ issuer: 'GABCDEFGHIJKLMNOP', total_issued: 77 }] },
    });
    await act(async () => { render(<AnalyticsDashboard />); });
    expect(screen.getByRole('img', { name: 'MMR: 5 of 5 doses' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Flu: 0 of 5 doses' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Vaccination doses by vaccine type' })).toBeInTheDocument();
    expect(screen.getByText('Ledger 9')).toBeInTheDocument();
    expect(screen.getByText('77')).toBeInTheDocument();
  });

  it('distinguishes missing counts and empty lists from zero', async () => {
    serve({ rates: { rates: [{ vaccine_name: 'MMR', count: null }] }, issuers: { issuers: [] }, anomalies: { flagged_issuers: [] } });
    await act(async () => { render(<AnalyticsDashboard />); });
    expect(screen.getByRole('cell', { name: 'Not reported' })).toBeInTheDocument();
    expect(screen.getByText(/No issuers have minted/)).toBeInTheDocument();
  });

  it('marks HTTP failures unavailable, not empty', async () => {
    useAuth.mockReturnValue({ role: 'issuer' });
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    await act(async () => { render(<AnalyticsDashboard />); });
    expect(screen.getAllByText(/Data unavailable/)).toHaveLength(3);
    expect(screen.queryByText(/No anomalies/)).toBeNull();
  });

  it('keeps old data and marks it delayed when a refresh fails', async () => {
    serve({ rates: mockRates, issuers: mockIssuers, anomalies: mockAnomalies });
    await act(async () => { render(<AnalyticsDashboard />); });
    global.fetch = jest.fn().mockRejectedValue(new Error('down'));
    await act(async () => { jest.advanceTimersByTime(60_000); });
    expect(screen.getAllByText(/Delayed: showing data from/)).toHaveLength(3);
    expect(screen.getByText('COVID-19')).toBeInTheDocument();
  });
});
