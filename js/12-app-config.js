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
      encryption: 'RHW/SOVEREIGN-MK-IV // ML-KEM-1024 + AES-256-GCM // KEYSET THORNE-07',
      closing: 'Yours faithfully,'
    })
  ]),
  templates: Object.freeze([
    Object.freeze({
      key: 'formal',
      label: 'FORMAL TRANSMISSION',
      description: 'Official RHW correspondence with full sender and encryption metadata.',
      recipient: '',
      encryption: 'CROWN/TYPEX-MK-VIII // ML-KEM-1024 + AES-256-GCM // KEYSET LION-01',
      classification: 'RHW OFFICIAL',
      accent: '#d4af37',
      subjectPlaceholder: 'Transmission subject'
    }),
    Object.freeze({
      key: 'procurement',
      label: 'PROCUREMENT',
      description: 'Formal procurement or military-industrial correspondence.',
      recipient: 'Bretonia Armed Forces | Admiralty Procurement Office',
      encryption: 'ADMIRALTY/IRONCLAD-MK-VI // ML-KEM-1024 + AES-256-GCM // KEYSET VICTORIA-03',
      classification: 'CROWN RESTRICTED',
      accent: '#d4af37',
      subjectPlaceholder: 'Procurement subject'
    }),
    Object.freeze({
      key: 'trade',
      label: 'TRADE OFFER',
      description: 'Commercial offer, supply proposal or trading communication.',
      recipient: '',
      encryption: 'BMM/BLACKTHORN-MK-IV // X25519 + CHACHA20-POLY1305 // KEYSET THAMES-11',
      classification: 'COMMERCIAL CONFIDENTIAL',
      accent: '#c6a75a',
      subjectPlaceholder: 'Commercial subject'
    }),
    Object.freeze({
      key: 'operations',
      label: 'OPERATIONS BULLETIN',
      description: 'Internal production, logistics or yard operations message.',
      recipient: 'RHW Operations Network',
      encryption: 'RHW/RESOLUTION-MK-V // X25519 + AES-256-GCM // KEYSET NEW-LONDON-06',
      classification: 'RHW INTERNAL',
      accent: '#7da7ea',
      subjectPlaceholder: 'Operations subject'
    }),
    Object.freeze({
      key: 'incident',
      label: 'INCIDENT REPORT',
      description: 'Priority incident, security or facility-status transmission.',
      recipient: 'RHW Command',
      encryption: 'CROWN/SOVEREIGN-MK-IX // ML-KEM-1024 + AES-256-GCM // KEYSET RED-LION-01',
      classification: 'PRIORITY // RESTRICTED',
      accent: '#c75e5e',
      subjectPlaceholder: 'Incident subject'
    }),
    Object.freeze({
      key: 'announcement',
      label: 'GENERAL ANNOUNCEMENT',
      description: 'Public-facing RHW statement or general bulletin.',
      recipient: 'Open Broadcast',
      encryption: 'RHW/HERALD-MK-II // X25519 + CHACHA20-POLY1305 // KEYSET CROWN-BROADCAST-04',
      classification: 'PUBLIC RELEASE',
      accent: '#d4af37',
      subjectPlaceholder: 'Announcement subject'
    })
  ])
});
