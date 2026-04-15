"""
SmartSales ML Models — unchanged architecture.
Two forecasting models per product, compared at inference.

1. SalesLSTM      — 2-layer LSTM
2. SeasonalLinear — trend + weekly/monthly Fourier features
"""

import math
import numpy as np
import torch
import torch.nn as nn


class SalesLSTM(nn.Module):
    def __init__(self, input_size=1, hidden_size=64, num_layers=2,
                 forecast_horizon=30, dropout=0.2):
        super().__init__()
        self.forecast_horizon = forecast_horizon
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers,
                            batch_first=True,
                            dropout=dropout if num_layers > 1 else 0.0)
        self.head = nn.Sequential(
            nn.Linear(hidden_size, hidden_size // 2), nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, forecast_horizon),
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.head(out[:, -1, :])


def _fourier(t, periods, n_terms=3):
    cols = []
    for p in periods:
        for k in range(1, n_terms + 1):
            cols += [np.sin(2 * math.pi * k * t / p),
                     np.cos(2 * math.pi * k * t / p)]
    return np.stack(cols, axis=1).astype(np.float32)


class SeasonalLinear(nn.Module):
    PERIODS = [7.0, 30.44]
    N_TERMS = 3

    def __init__(self, forecast_horizon=30):
        super().__init__()
        self.forecast_horizon = forecast_horizon
        n_fourier = 2 * self.N_TERMS * len(self.PERIODS)
        self.linear = nn.Linear((n_fourier + 1) * forecast_horizon, forecast_horizon)

    @classmethod
    def future_features(cls, last_t, H):
        t      = np.arange(last_t + 1, last_t + 1 + H, dtype=np.float32)
        fourier = _fourier(t, cls.PERIODS, cls.N_TERMS)
        trend   = (t / (last_t + 1.0)).reshape(-1, 1)
        feats   = np.concatenate([fourier, trend], axis=1)
        return torch.tensor(feats.flatten(), dtype=torch.float32).unsqueeze(0)

    def forward(self, x):
        return self.linear(x)


class ForecastEnsemble:
    def __init__(self, mean, std, seq_len=60, forecast_horizon=30, device="cpu"):
        self.mean = mean
        self.std  = std
        self.seq_len = seq_len
        self.forecast_horizon = forecast_horizon
        self.device = torch.device(device)
        self.lstm     = SalesLSTM(forecast_horizon=forecast_horizon).to(self.device)
        self.seasonal = SeasonalLinear(forecast_horizon=forecast_horizon).to(self.device)

    def _norm(self, x):   return (x - self.mean) / (self.std + 1e-8)
    def _denorm(self, x): return np.clip(x * (self.std + 1e-8) + self.mean, 0, None)

    def predict(self, recent_window, last_t):
        norm_w = self._norm(recent_window)
        self.lstm.eval()
        x_l = torch.tensor(norm_w, dtype=torch.float32).unsqueeze(0).unsqueeze(-1).to(self.device)
        with torch.no_grad():
            lstm_n = self.lstm(x_l).squeeze(0).cpu().numpy()

        self.seasonal.eval()
        x_s = SeasonalLinear.future_features(last_t, self.forecast_horizon).to(self.device)
        with torch.no_grad():
            sea_n = self.seasonal(x_s).squeeze(0).cpu().numpy()

        lstm_r = self._denorm(lstm_n)
        sea_r  = self._denorm(sea_n)
        return {"lstm": lstm_r, "seasonal": sea_r, "ensemble": (lstm_r + sea_r) / 2}
