import { api, getApiErrorMessage } from '@/lib/api';
import { toast } from '@/lib/toast';

type RunApiActionOptions = {
  successMessage?: string;
  errorMessage?: string;
  silent?: boolean;
};

/** Para llamadas imperativas fuera de useMutation (ej. login). */
export async function runApiAction<T>(
  action: () => Promise<T>,
  options: RunApiActionOptions = {},
): Promise<T | null> {
  try {
    const result = await action();
    if (options.successMessage) toast.success(options.successMessage);
    return result;
  } catch (error) {
    if (!options.silent) {
      toast.error(getApiErrorMessage(error, options.errorMessage ?? 'No se pudo completar la acción'));
    }
    return null;
  }
}

export { api };
