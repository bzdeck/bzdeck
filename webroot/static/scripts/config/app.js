/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the app namespace.
 * @namespace
 */
const BzDeck = {};

/**
 * Config
 */
BzDeck.config = {
  // List of supported Bugzilla instances
  hosts: {
    mozilla: {
      label: 'Mozilla',
      timezone: -8,
      default_assignee: 'nobody@mozilla.org',
      origin: 'https://bugzilla.mozilla.org',
      endpoints: {
        bzapi: '/bzapi/',
        rest: '/rest/',
        websocket: 'wss://bugzfeed.mozilla.org/',
      }
    },
    'mozilla-dev': {
      label: 'Mozilla Dev',
      timezone: -8,
      default_assignee: 'nobody@mozilla.org',
      origin: 'https://bugzilla-dev.allizom.org',
      endpoints: {
        bzapi: '/bzapi/',
        rest: '/rest/',
        websocket: 'wss://bugzfeed.mozilla.org/dev/',
      }
    },
    'mozilla-merge': {
      label: 'Mozilla Merge',
      timezone: -8,
      default_assignee: 'nobody@mozilla.org',
      origin: 'https://bugzilla-merge.allizom.org',
      endpoints: {
        bzapi: 'https://bugzilla.mozilla.org/bzapi/', // Use production until Bug 1269213 is solved
        rest: '/rest/',
        websocket: null,
      }
    }
  },
  // App path
  app: {
    root: '/',
    launch_path: '/home/inbox',
  },
  // Columns on classic threads
  grid: {
    default_columns: [
      // Custom
      { id: 'starred', label: 'Starred', type: 'boolean' },
      // Name
      { id: 'id', label: 'ID' /* instead of Bug ID */, type: 'integer' },
      { id: 'alias', hidden: true },
      { id: 'summary' },
      // Status
      { id: 'status', hidden: true },
      { id: 'resolution', hidden: true },
      { id: 'target_milestone', hidden: true },
      // Affected
      { id: 'classification', hidden: true },
      { id: 'product' },
      { id: 'component' },
      { id: 'version', hidden: true },
      { id: 'platform', hidden: true },
      { id: 'op_sys', hidden: true },
      // Importance
      { id: 'severity', hidden: true },
      { id: 'priority', hidden: true },
      // Notes
      { id: 'whiteboard', hidden: true },
      { id: 'keywords', hidden: true },
      { id: 'url', hidden: true },
      // Participants
      { id: 'creator', type: 'person', hidden: true },
      { id: 'assigned_to', type: 'person', hidden: true },
      { id: 'qa_contact', type: 'person', hidden: true },
      { id: 'mentors', label: 'Mentors' /* Not found in the config */, type: 'people', hidden: true },
      // Dates
      { id: 'creation_time', type: 'time', hidden: true },
      { id: 'last_change_time', type: 'time' },
    ]
  },
  // Preferences types and default values
  prefs: {
    // Theme
    'ui.theme.selected': { type: 'string', default: 'Light' },
    // Timezone & Date Format
    'ui.date.timezone': { type: 'string', default: 'local' },
    'ui.date.relative': { type: 'boolean', default: true },
    // Notifications
    'notifications.show_desktop_notifications': { type: 'boolean', default: true },
    'notifications.ignore_cc_changes': { type: 'boolean', default: true },
    // Home
    'ui.home.layout': { type: 'string', default: 'vertical' },
    // Timeline
    'ui.timeline.sort.order': { type: 'string', default: 'ascending' },
    'ui.timeline.font.family': { type: 'string', default: 'proportional' },
    'ui.timeline.show_cc_changes': { type: 'boolean', default: false },
    'ui.timeline.display_attachments_inline': { type: 'boolean', default: true },
  },
  // Sidebar folders
  folders: [
    {
      id: 'sidebar-folders--inbox',
      label: 'Inbox',
      selected: true,
      data: { id: 'inbox' }
    },
    {
      id: 'sidebar-folders--starred',
      label: 'Starred',
      data: { id: 'starred' }
    },
    {
      id: 'sidebar-folders--requests',
      label: 'Requests',
      data: { id: 'requests' }
    },
    {
      id: 'sidebar-folders--reported',
      label: 'Reported',
      data: { id: 'reported' }
    },
    {
      id: 'sidebar-folders--watching',
      label: 'Watching', // was CCed
      data: { id: 'watching' }
    },
    {
      id: 'sidebar-folders--assigned',
      label: 'Assigned',
      data: { id: 'assigned' }
    },
    {
      id: 'sidebar-folders--mentor',
      label: 'Mentor',
      data: { id: 'mentor' }
    },
    {
      id: 'sidebar-folders--qa',
      label: 'QA',
      data: { id: 'qa' }
    },
    {
      id: 'sidebar-folders--all',
      label: 'All Bugs',
      data: { id: 'all' }
    }
  ],
};
