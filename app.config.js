const fs = require('fs');
const { expo } = require('./app.json');

const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();
const googleServicesFile = './google-services.json';

module.exports = {
  expo: {
    ...expo,
    android: {
      ...expo.android,
      ...(fs.existsSync(googleServicesFile) ? { googleServicesFile } : {}),
    },
    extra: {
      ...(expo.extra ?? {}),
      ...(easProjectId ? { eas: { projectId: easProjectId } } : {}),
    },
  },
};
