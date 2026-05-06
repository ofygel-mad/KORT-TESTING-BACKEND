import { AxiosError } from 'axios';

type ApiErrorPayload = {
  detail?: string;
  message?: string;
  error?: string;
  code?: string;
};

function readAxiosError(error: unknown) {
  return error instanceof AxiosError ? error : null;
}

export function readApiErrorStatus(error: unknown) {
  return readAxiosError(error)?.response?.status;
}

export function readApiErrorPayload(error: unknown): ApiErrorPayload | undefined {
  const payload = readAxiosError(error)?.response?.data;
  return payload && typeof payload === 'object' ? (payload as ApiErrorPayload) : undefined;
}

export function readApiErrorCode(error: unknown) {
  return readApiErrorPayload(error)?.code ?? readApiErrorPayload(error)?.error;
}

export function readApiErrorMessage(error: unknown, fallback = 'Something went wrong') {
  const payload = readApiErrorPayload(error);

  if (payload?.detail && payload.detail.trim()) {
    return payload.detail.trim();
  }

  if (payload?.message && payload.message.trim()) {
    return payload.message.trim();
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback;
}
