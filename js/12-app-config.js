// ============================================================
// RHW WEB APP CONFIGURATION · V4.0 PREVIEW
// App navigation, COMMS presets and built-in sender identities.
// ============================================================
const RHW_APP_VERSION = 'V4.0 PREVIEW';

const RHW_APP_CONFIG = Object.freeze({
  storageKeys: Object.freeze({
    activeWorkspace: 'rhw-webapp-v4:workspace',
    commsCurrent: 'rhw-webapp-v4:comms-current',
    commsDrafts: 'rhw-webapp-v4:comms-drafts',
    localSenders: 'rhw-webapp-v4:local-senders'
  }),
  forum: Object.freeze({
    logoUrl: 'https://i.imgur.com/TFXQ1So.png',
    organisation: 'RESOLUTION HEAVY WORKS',
    subline: 'INDUSTRIAL MANUFACTURING HUB | NEW LONDON',
    brandColor: '#d4af37',
    textColor: '#E0E0E0',
    mutedColor: '#808080',
    dangerColor: '#A52A2A',
    darkLineColor: '#333333',
    footerColor: '#555555',
    footerMotto: 'CONNECTION SECURE /// BUILT IN BRETONIA - BUILT FOR THE CROWN'
  }),
  senders: Object.freeze([
    Object.freeze({
      key: 'alistair-thorne',
      name: 'Alistair Thorne',
      title: 'CEO | Thorne Industrial Group',
      location: 'Resolution Heavy Works, New London',
      encryption: 'Crown-Command-Channel-01',
      closing: 'Yours faithfully,'
    })
  ]),
  templates: Object.freeze([
    Object.freeze({
      key: 'formal',
      label: 'FORMAL TRANSMISSION',
      description: 'Official RHW correspondence with full sender and channel metadata.',
      recipient: '',
      encryption: 'Crown-Command-Channel-01',
      subjectPlaceholder: 'Transmission subject'
    }),
    Object.freeze({
      key: 'procurement',
      label: 'PROCUREMENT',
      description: 'Formal procurement or military-industrial correspondence.',
      recipient: 'Bretonia Armed Forces | Admiralty Procurement Office',
      encryption: 'Crown-Command-Channel-01',
      subjectPlaceholder: 'Procurement subject'
    }),
    Object.freeze({
      key: 'trade',
      label: 'TRADE OFFER',
      description: 'Commercial offer, supply proposal or trading communication.',
      recipient: '',
      encryption: 'RHW-Commercial-Channel-01',
      subjectPlaceholder: 'Commercial subject'
    }),
    Object.freeze({
      key: 'operations',
      label: 'OPERATIONS BULLETIN',
      description: 'Internal production, logistics or yard operations message.',
      recipient: 'RHW Operations Network',
      encryption: 'RHW-Internal-Channel-01',
      subjectPlaceholder: 'Operations subject'
    }),
    Object.freeze({
      key: 'incident',
      label: 'INCIDENT REPORT',
      description: 'Priority incident, security or facility-status transmission.',
      recipient: 'RHW Command',
      encryption: 'RHW-Command-Priority-01',
      subjectPlaceholder: 'Incident subject'
    }),
    Object.freeze({
      key: 'announcement',
      label: 'GENERAL ANNOUNCEMENT',
      description: 'Public-facing RHW statement or general bulletin.',
      recipient: 'Open Broadcast',
      encryption: 'RHW-Public-Channel-01',
      subjectPlaceholder: 'Announcement subject'
    })
  ])
});
