/**
 * BzDeck Configurations
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

/* ------------------------------------------------------------------------------------------------------------------
 * Config
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.config = {
  'servers': [
    {
      'name': 'mozilla',
      'label': 'Mozilla',
      'timezone': -8,
      'url': 'https://bugzilla.mozilla.org',
      'endpoints': {
        'bzapi': '/bzapi/',
        'rest': '/rest/',
        'websocket': 'wss://bugzfeed.mozilla.org/'
      }
    }
  ],
  'app': {
    'root': '/',
    'launch_path': '/home/inbox',
    'manifest': `${location.origin}/manifest.webapp`
  },
  'grid': {
    'default_columns': [
      // Custom
      { 'id': '_starred', 'label': 'Starred', 'type': 'boolean' },
      { 'id': '_unread', 'label': 'Unread', 'type': 'boolean', 'hidden': true },
      // Name
      { 'id': 'id', 'label': 'ID' /* instead of Bug ID */, 'type': 'integer' },
      { 'id': 'alias', 'hidden': true },
      { 'id': 'summary' },
      // Status
      { 'id': 'status', 'hidden': true },
      { 'id': 'resolution', 'hidden': true },
      { 'id': 'target_milestone', 'hidden': true },
      // Affected
      { 'id': 'classification', 'hidden': true },
      { 'id': 'product' },
      { 'id': 'component' },
      { 'id': 'version', 'hidden': true },
      { 'id': 'platform', 'hidden': true },
      { 'id': 'op_sys', 'hidden': true },
      // Importance
      { 'id': 'severity', 'hidden': true },
      { 'id': 'priority', 'hidden': true },
      // Notes
      { 'id': 'whiteboard', 'hidden': true },
      { 'id': 'keywords', 'hidden': true },
      { 'id': 'url', 'hidden': true },
      // People
      { 'id': 'creator', 'type': 'person', 'hidden': true },
      { 'id': 'assigned_to', 'type': 'person', 'hidden': true },
      { 'id': 'qa_contact', 'type': 'person', 'hidden': true },
      { 'id': 'mentors', 'label': 'Mentors' /* Not found in the config */, 'type': 'people', 'hidden': true },
      // Dates
      { 'id': 'creation_time', 'type': 'time', 'hidden': true },
      { 'id': 'last_change_time', 'type': 'time' },
    ]
  }
};
