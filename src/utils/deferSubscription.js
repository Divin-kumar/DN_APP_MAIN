// Let callers cancel a subscription while its account module is still loading.
export function deferSubscription(load, subscribe, fail) {
  let stopped = false;
  let unsubscribe;
  void load().then((service) => {
    if (!stopped) unsubscribe = subscribe(service);
  }).catch((error) => {
    if (!stopped) fail(error);
  });
  return () => {
    stopped = true;
    unsubscribe?.();
  };
}
