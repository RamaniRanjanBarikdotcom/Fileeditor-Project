# Blog Studio Rollback Procedure

If the Blog Studio full-parity rollout causes instability or upstream synchronization issues, you can safely disable the feature globally without losing user data.

## Procedure

1. Open `.env` and set the following feature flags to `false`:
   ```
   FEATURE_BLOG_STUDIO_FULL_SUITE=false
   ```
2. Restart the backend services: `npm run start:api`
3. The UI will automatically hide the Blog Studio sidebar items and disable the `RequireFeatures` endpoints.
4. Existing generated articles, scheduled tasks, and configurations will remain safely in the database, but will be inaccessible to end-users until the flag is restored.
