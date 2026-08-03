import { createLandingAnalyticsRuntime, readLandingAnalyticsConfig } from './analytics/runtime';
import { bindLandingAnalytics } from './analytics/tracking';

const config = readLandingAnalyticsConfig();

if (config) {
  const runtime = createLandingAnalyticsRuntime(config);
  bindLandingAnalytics(runtime);
  void runtime.initialize();
}
