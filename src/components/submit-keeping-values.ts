import { startTransition, type FormEvent } from "react";

/**
 * onSubmit for a useActionState form that skips React's automatic form reset,
 * which would also wipe what the user typed when the server says no (e.g. a
 * wrong password). Forms reset themselves on success where that matters.
 */
export function submitKeepingValues(dispatch: (fd: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
}
