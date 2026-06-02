// Core templates for beetleai.dev
export { baseTemplate } from './baseTemplate.js';
export { defaultTemplate } from './defaultTemplate.js';

// Analysis-related templates
export { analysisCompleteTemplate } from './analysisCompleteTemplate.js';
export { analysisErrorTemplate } from './analysisErrorTemplate.js';

// User management templates
export { welcomeTemplate } from './welcomeTemplate.js';
export { earlyAccessTemplate } from './earlyAccessTemplate.js';

// Team templates
export { teamInviteTemplate } from './teamInviteTemplate.js';

// Template type mapping for easy access
export const templates = {
  default: 'defaultTemplate',
  analysisComplete: 'analysisCompleteTemplate',
  analysisError: 'analysisErrorTemplate',
  welcome: 'welcomeTemplate',
  earlyAccess: 'earlyAccessTemplate',
  teamInvite: 'teamInviteTemplate',
} as const;

export type TemplateType = keyof typeof templates;

