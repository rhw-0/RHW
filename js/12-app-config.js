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
      encryption: 'RHW-RESOLUTION/V · KEY THORNE-07',
      closing: 'Yours faithfully,'
    })
  ]),
  templates: Object.freeze([
    Object.freeze({
      key: 'formal',
      label: 'FORMAL TRANSMISSION',
      description: 'Official RHW correspondence with full sender and encryption metadata.',
      recipient: '',
      encryption: 'CROWN-TYPEX/VIII · KEY LION-01',
      classification: 'RHW OFFICIAL',
      closing: 'Yours faithfully,',
      accent: '#d4af37',
      subjectPlaceholder: 'Transmission subject'
    }),
    Object.freeze({
      key: 'procurement',
      label: 'PROCUREMENT',
      description: 'Formal procurement or military-industrial correspondence.',
      recipient: 'Bretonia Armed Forces | Admiralty Procurement Office',
      encryption: 'ADMIRALTY-IRONCLAD/VI · KEY VICTORIA-03',
      classification: 'CROWN RESTRICTED',
      closing: 'Respectfully,',
      accent: '#d4af37',
      subjectPlaceholder: 'Procurement subject'
    }),
    Object.freeze({
      key: 'trade',
      label: 'TRADE OFFER',
      description: 'Commercial offer, supply proposal or trading communication.',
      recipient: '',
      encryption: 'BMM-BLACKTHORN/IV · KEY THAMES-11',
      classification: 'COMMERCIAL CONFIDENTIAL',
      closing: 'With highest regards,',
      accent: '#c6a75a',
      subjectPlaceholder: 'Commercial subject'
    }),
    Object.freeze({
      key: 'operations',
      label: 'OPERATIONS BULLETIN',
      description: 'Internal production, logistics or yard operations message.',
      recipient: 'RHW Operations Network',
      encryption: 'RHW-RESOLUTION/V · KEY NEW-LONDON-06',
      classification: 'RHW INTERNAL',
      closing: 'For Resolution Heavy Works,',
      accent: '#7da7ea',
      subjectPlaceholder: 'Operations subject'
    }),
    Object.freeze({
      key: 'incident',
      label: 'INCIDENT REPORT',
      description: 'Priority incident, security or facility-status transmission.',
      recipient: 'RHW Command',
      encryption: 'CROWN-SOVEREIGN/IX · KEY RED-LION-01',
      classification: 'PRIORITY // RESTRICTED',
      closing: 'Respectfully,',
      accent: '#c75e5e',
      subjectPlaceholder: 'Incident subject'
    }),
    Object.freeze({
      key: 'announcement',
      label: 'GENERAL ANNOUNCEMENT',
      description: 'Public-facing RHW statement or general bulletin.',
      recipient: 'Open Broadcast',
      encryption: 'RHW-HERALD/II · KEY CROWN-04',
      classification: 'PUBLIC RELEASE',
      closing: 'For Resolution Heavy Works,',
      accent: '#d4af37',
      subjectPlaceholder: 'Announcement subject'
    })
  ])
});
