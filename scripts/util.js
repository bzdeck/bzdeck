/**
 * FlareTail Utility Functions
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

let FlareTail = FlareTail || {};

FlareTail.util = {};

/* ------------------------------------------------------------------------------------------------------------------
 * Compatibility
 * ------------------------------------------------------------------------------------------------------------------ */

{
  let features = [
    'toLocaleFormat' in Date.prototype, // Gecko specific
    'FileReader' in window, // Firefox 3.6
    'Proxy' in window, // Firefox 4
    'IDBObjectStore' in window, // Firefox 4
    'createObjectURL' in URL, // Firefox 4
    'mozGetAll' in IDBObjectStore.prototype, // Firefox 4, still prefixed
    'matchMedia' in window, // Firefox 6
    'WeakMap' in window, // Firefox 6
    'Blob' in window, // Firefox 13
    'Set' in window, // Firefox 13
    'MutationObserver' in window, // Firefox 14
    'buttons' in MouseEvent.prototype, // Firefox 15
    'isNaN' in Number, // Firefox 15
    'scrollTopMax' in Element.prototype, // Firefox 16
    'isInteger' in Number, // Firefox 16
    'indexedDB' in window, // unprefixed in Firefox 16
    'onwheel' in window, // Firefox 17
    'origin' in location, // Firefox 21
    'HTMLTemplateElement' in window, // Firefox 22
    'Notification' in window, // Firefox 22
    'remove' in Element.prototype, // Firefox 23
    'parseInt' in Number, // Firefox 25
    'createTBody' in HTMLTableElement.prototype, // Firefox 25
    'entries' in Array.prototype, // Firefox 28
    'Promise' in window, // Firefox 29
    'URLSearchParams' in window, // Firefox 29
    'escape' in CSS, // Firefox 31
    'getBoxQuads' in Element.prototype, // Firefox 31
    'Symbol' in window && 'iterator' in Symbol && Symbol.iterator in StyleSheetList.prototype, // Firefox 31, 36
    'Symbol' in window && 'iterator' in Symbol && Symbol.iterator in CSSRuleList.prototype, // Firefox 32, 36
    'assign' in Object, // Firefox 34
    'matches' in Element.prototype, // Firefox 34
  ];

  let compatible = true;

  try {
    // (Strict) feature detection & arrow function expression (Firefox 22)
    if (!features.every(item => item)) {
      throw new Error;
    }

    // Iterator and destructuring assignment (Firefox 2)
    // for...of loop (Firefox 13)
    for (let [key, value] of Iterator(['a', 'b', 'c'])) if (key === 1) {}

    // Direct Proxy (Firefox 18; constructor)
    new Proxy({}, {});

    // Spread operation in function calls (Firefox 27)
    [0, 1, 2].push(...[3, 4, 5]);

    // ES6 Array comprehensions (Firefox 30)
    [for (item of Iterator(['a', 'b', 'c'])) if (item[0] === 1) item[1]];

    // ES6 shorthand properties in object literals (Firefox 33)
    let a = 1, b = 2, c = { a, b };

    // ES6 Template Literals (Firefox 34)
    let d = `a: ${a}, b: ${b}`;
  } catch (ex) {
    compatible = false;
  }

  Object.defineProperty(FlareTail.util, 'compatible', {
    'enumerable': true,
    'value': compatible
  });
}

/* ------------------------------------------------------------------------------------------------------------------
 * Polyfills
 * ------------------------------------------------------------------------------------------------------------------ */

if (typeof Array.prototype.includes !== 'function') {
  Array.prototype.includes = function (item) {
    return Array.prototype.indexOf.call(this, item) > -1;
  }
}

if (typeof String.prototype.includes !== 'function') {
  String.prototype.includes = function (item) {
    return String.prototype.search.call(this, new RegExp(item)) > -1;
  }
}

/* ------------------------------------------------------------------------------------------------------------------
 * Content
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.content = {};

FlareTail.util.content.fill = function ($scope, data, attrs = {}) {
  let iterate = ($scope, data) => {
    for (let [prop, value] of Iterator(data)) {
      for (let $item of $scope.properties[prop] || []) {
        // Multiple items
        if (Array.isArray(value)) {
          let $parent = $item.parentElement,
              $_item = $parent.removeChild($item);

          $parent.innerHTML = ''; // Empty the loop before adding items

          for (let _value of value) {
            let $item = $parent.appendChild($_item.cloneNode(true));

            typeof _value === 'object' ? iterate($item, _value) : fill($item, _value);
          }
        } else {
          typeof value === 'object' ? iterate($item, value) : fill($item, value);
        }
      }
    }
  };

  let fill = ($item, value) => $item.dateTime !== undefined ? FlareTail.util.datetime.fill_element($item, value)
                                                            : $item.itemValue = value;

  $scope.setAttribute('aria-busy', 'true');

  // Microdata
  iterate($scope, data);

  // Attributes
  for (let [attr, value] of Iterator(attrs)) {
    let $items = [...$scope.querySelectorAll(`[data-attrs~="${CSS.escape(attr)}"]`)];

    if ($scope.matches(`[data-attrs~="${CSS.escape(attr)}"]`)) {
      $items.push($scope);
    }

    for (let $item of $items) {
      $item.setAttribute(attr, value);
    }
  }

  $scope.removeAttribute('aria-busy');

  return $scope;
};

FlareTail.util.content.get_fragment = function (id, prefix = undefined) {
  let $fragment = document.getElementById(id).content.cloneNode(true);

  if (prefix) {
    for (let attr of ['id', 'aria-owns', 'aria-controls', 'aria-labelledby']) {
      for (let $element of $fragment.querySelectorAll(`[${attr}]`)) {
        $element.setAttribute(attr, $element.getAttribute(attr).replace(/TID/, prefix));
      }
    }
  }

  return $fragment;
};

/* ------------------------------------------------------------------------------------------------------------------
 * Event
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.event = {};

FlareTail.util.event.ignore = event => {
  event.preventDefault();
  event.stopPropagation();

  return false;
};

// This function allows to set multiple event listeners as once
FlareTail.util.event.bind = function (that, $target, types, use_capture = false, unbind = false) {
  if (!$target) {
    return false;
  }

  for (let type of types) {
    if (!that[`on${type}`]) {
      continue; // No such handler
    }

    unbind ? $target.removeEventListener(type, that, use_capture) : $target.addEventListener(type, that, use_capture);
  }

  return true;
};

FlareTail.util.event.unbind = function (that, $target, types, use_capture = false) {
  this.bind(that, $target, types, use_capture, true);
};

// Async event handling using postMessage
FlareTail.util.event.async = function (callback) {
  if (this.queue === undefined) {
    this.queue = [];

    window.addEventListener('message', event => {
      if (event.source === window && event.data === 'AsyncEvent' && this.queue.length) {
        this.queue.shift().call();
      }
    });
  }

  this.queue.push(callback);
  window.postMessage('AsyncEvent', location.origin);
};

// Custom event dispatcher. The async option is enabled by default
FlareTail.util.event.trigger = function ($target, type, options = {}, async = true) {
  let callback = () => $target.dispatchEvent(new CustomEvent(type, options));

  // Local files have no origin (Bug 878297)
  async && location.origin !== 'null' ? this.async(callback) : callback();
};

/* ------------------------------------------------------------------------------------------------------------------
 * Keyboard
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.kbd = {};

/* ------------------------------------------------------------------------------------------------------------------
 * Assign keyboard shortcuts on a specific element
 *
 * @param   {Element} $target
 * @param   {Object} A map of keybind patterns ('S', 'Accel+Shift+R', 'Control+O', etc.
                     Multiple pattern should be separated with '|') and function.
                     Possible key values can be found at MDN:
                     https://developer.mozilla.org/docs/Web/API/KeyboardEvent/key
                     https://developer.mozilla.org/docs/Web/API/KeyboardEvent/getModifierState
 * ------------------------------------------------------------------------------------------------------------------ */
FlareTail.util.kbd.assign = function ($target, map) {
  let bindings = new Set();

  for (let [_combos, command] of Iterator(map)) for (let _combo of _combos.split('|')) {
    let combo = _combo.split('+'),
        key = combo.pop().toLowerCase().replace('Space', ' '), // Space is an exception
        modifiers = new Set(combo);

    bindings.add([key, modifiers, command]);
  }

  $target.addEventListener('keydown', event => {
    let found = false;

    outer: for (let [key, modifiers, command] of bindings) {
      // Check the key value
      if (event.key.toLowerCase() !== key) {
        continue;
      }

      // Check modifier keys
      for (let mod of ['Alt', 'Shift', 'Control', 'Meta', 'Accel']) {
        if (modifiers.has(mod) && !event.getModifierState(mod) ||
            !modifiers.has(mod) && event.getModifierState(mod)) {
          continue outer;
        }
      }

      // Execute command
      found = true;
      command(event);

      break;
    }

    return found ? FlareTail.util.event.ignore(event) : true;
  });
};

/* ------------------------------------------------------------------------------------------------------------------
 * Fire a keydown event on a specific element
 *
 * @param   {Element} $target
 * @param   {Integer} key
 * ------------------------------------------------------------------------------------------------------------------ */
FlareTail.util.kbd.dispatch = function ($target, key) {
  $target.dispatchEvent(new KeyboardEvent('keydown', { key }));
};

/* ------------------------------------------------------------------------------------------------------------------
 * Preferences
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.prefs = {};

/* ------------------------------------------------------------------------------------------------------------------
 * Storage
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.Storage = function () {
  let req = this.request = indexedDB.open('MyTestDatabase', 1),
      db = this.db = null;

  req.addEventListener('error', event => {});
  req.addEventListener('success', event => db = request.result);
  db.addEventListener('error', event => {});
};

/* ------------------------------------------------------------------------------------------------------------------
 * User Agent
 *
 * This utility only considers Gecko-based products for now
 * https://developer.mozilla.org/en-US/docs/Gecko_user_agent_string_reference
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.ua = {
  'device': {
    'type': 'unknown',
    'tv': false,
    'desktop': false,
    'mobile': false,
    'tablet': false,
    'phone': false,
  },
  'platform': {
    'name': 'unknown',
    'windows': false,
    'macintosh': false,
    'linux': false,
    'android': false,
    'firefox': false,
  },
  'touch': {
    'enabled': window.matchMedia('(-moz-touch-enabled: 1)').matches
  }
};

{
  let ua = FlareTail.util.ua,
      ua_str = navigator.userAgent,
      pf_match = ua_str.match(/Windows|Macintosh|Linux|Android|Firefox/);

  // Platform
  if (pf_match) {
    ua.platform.name = pf_match[0].toLowerCase();
    ua.platform[ua.platform.name] = true;
  }

  // Device
  if (ua_str.includes('Mobile')) {
    ua.device.type = 'mobile-phone';
    ua.device.mobile = true;
    ua.device.phone = true;
  } else if (ua_str.includes('Tablet')) {
    ua.device.type = 'mobile-tablet';
    ua.device.mobile = true;
    ua.device.tablet = true;
  } else if (ua.platform.firefox) {
    ua.device.type = 'tv';
    ua.device.tv = true;
  } else {
    ua.device.type = 'desktop';
    ua.device.desktop = true;
  }

  document.documentElement.setAttribute('data-device', ua.device.type);
  document.documentElement.setAttribute('data-platform', ua.platform.name);
}

/* ------------------------------------------------------------------------------------------------------------------
 * App
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.app = {};

FlareTail.util.app.can_install = function (manifest = location.origin + '/manifest.webapp') {
  let apps = navigator.mozApps;

  return new Promise((resolve, reject) => {
    if (apps) {
      let request = apps.checkInstalled(manifest);

      request.addEventListener('success', event =>
        request.result ? reject(new Error('The app has already been installed')) : resolve());
      request.addEventListener('error', event => reject(new Error('Unknown error')));
    } else {
      reject(new Error('The app runtime is not available'));
    }
  });
};

FlareTail.util.app.install = function (manifest = location.origin + '/manifest.webapp') {
  let request = navigator.mozApps.install(manifest);

  return new Promise((resolve, reject) => {
    request.addEventListener('success', event => {
      FlareTail.util.event.trigger(window, 'AppInstalled');
      resolve();
    });
    request.addEventListener('error', event => {
      FlareTail.util.event.trigger(window, 'AppInstallFailed');
      reject(new Error(request.error.name));
    });
  });
};

FlareTail.util.app.fullscreen_enabled = function () {
  return document.mozFullScreenEnabled;
};

FlareTail.util.app.toggle_fullscreen = function ($element = document.body) {
  document.mozFullScreenElement ? document.mozCancelFullScreen() : $element.mozRequestFullScreen();
};

FlareTail.util.app.auth_notification = function () {
  if (Notification.permission !== 'granted') {
    Notification.requestPermission(permission => {});
  }
};

FlareTail.util.app.show_notification = function (title, options) {
  let notification = new Notification(title, options);

  return new Promise(resolve => notification.addEventListener('click', event => resolve(event)));
};

/* ------------------------------------------------------------------------------------------------------------------
 * Theme
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.theme = {};

Object.defineProperties(FlareTail.util.theme, {
  'list': {
    'enumerable': true,
    'get': () => document.styleSheetSets
  },
  'default': {
    'enumerable': true,
    'get': () => document.preferredStyleSheetSet
  },
  'selected': {
    'enumerable': true,
    'get': () => document.selectedStyleSheetSet,
    'set': name => document.selectedStyleSheetSet = name
  }
});

FlareTail.util.theme.preload_images = function () {
  let pattern = 'url\\("(.+?)"\\)',
      images = new Set();

  for (let sheet of document.styleSheets) {
    for (let rule of sheet.cssRules) {
      let match = rule.style && rule.style.backgroundImage && rule.style.backgroundImage.match(RegExp(pattern, 'g'));

      if (!match) {
        continue;
      }

      // Support for multiple background
      for (let m of match) {
        let src = m.match(RegExp(pattern))[1];

        if (!images.has(src)) {
          images.add(src);
        }
      }
    }
  }

  let _load = src => new Promise((resolve, reject) => {
    let image = new Image();

    image.addEventListener('load', event => resolve());
    image.src = src;
  });

  return Promise.all([for (src of images) _load(src)]);
};

/* ------------------------------------------------------------------------------------------------------------------
 * Date & Time
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.datetime = {};

FlareTail.util.datetime.options = new Proxy({
  'relative': false,
  'timezone': 'local',
  'updater_enabled': false,
  'updater_interval': 60 // seconds
}, {
  'get': (obj, prop) => obj[prop], // Always require the get trap (Bug 895223)
  'set': (obj, prop, value) => {
    let dt = FlareTail.util.datetime;

    obj[prop] = value;

    // Update timezone & format on the current view
    dt.update_elements();

    // Start or stop the timer if the relative option is changed
    if (prop === 'relative' || prop === 'updater_enabled') {
      if (!document.hidden && dt.options.relative && dt.options.updater_enabled && !dt.updater) {
        dt.start_updater();
      } else if (dt.updater) {
        dt.stop_updater();
      }
    }

    return true;
  }
});

FlareTail.util.datetime.format = function (str, options = {}) {
  options.relative = options.relative !== undefined ? options.relative : this.options.relative;
  options.simple = options.simple || false;
  options.timezone = options.timezone || this.options.timezone;

  let now = new Date(),
      date = new Date(str),
      delta = now - date,
      shifted_date;

  if (options.relative) {
    let patterns = [
      [1000 * 60 * 60 * 24 * 365, '%dyr', 'Last year', '%d years ago'],
      [1000 * 60 * 60 * 24 * 30, '%dmo', 'Last month', '%d months ago'],
      [1000 * 60 * 60 * 24, '%dd', 'Yesterday', '%d days ago'],
      [1000 * 60 * 60, '%dh', '1 hour ago', '%d hours ago'],
      [1000 * 60, '%dm', '1 minute ago', '%d minutes ago'],
      [1000, '%ds', 'Just now', '%d seconds ago'],
      [0, '%ds', 'Just now', 'Just now'] // Less than 1 second
    ];

    let format = (ms, simple, singular, plural) => {
      let value = Math.floor(delta / ms);

      return (options.simple ? simple : value === 1 ? singular : plural).replace('%d', value);
    };

    for (let pattern of patterns) if (delta > pattern[0]) {
      return format(...pattern);
    }
  }

  // Timezone conversion
  // TODO: Rewrite this once the timezone support is added to the ECMAScript Intl API (Bug 837961)
  // TODO: Get the timezone of the Bugzilla instance, instead of hardcoding PST
  if (options.timezone !== 'local') {
    shifted_date = this.get_shifted_date(date, options.timezone === 'PST' ? -8 : 0);
  }

  if (options.simple && date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
    let dates = now.getDate() - date.getDate();

    if (dates === 0) {
      return (shifted_date || date).toLocaleFormat('%R');
    }

    if (dates === 1) {
      return 'Yesterday';
    }
  }

  return (shifted_date || date).toLocaleFormat(options.simple ? '%b %e' : '%Y-%m-%d %R');
};

FlareTail.util.datetime.get_shifted_date = function (date, offset) {
  let dst = Math.max((new Date(date.getFullYear(), 0, 1)).getTimezoneOffset(),
                     (new Date(date.getFullYear(), 6, 1)).getTimezoneOffset())
                      > date.getTimezoneOffset(),
      utc = date.getTime() + (date.getTimezoneOffset() + (dst ? 60 : 0)) * 60000;

  return new Date(utc + offset * 3600000);
};

FlareTail.util.datetime.fill_element = function ($time, value, options = null) {
  if (!options) {
    options = {
      'relative': $time.dataset.relative ? JSON.parse($time.dataset.relative) : undefined,
      'simple': $time.dataset.simple ? JSON.parse($time.dataset.simple) : undefined
    };
  }

  $time.dateTime = value;
  $time.textContent = this.format(value, FlareTail.util.object.clone(options));
  $time.title = (new Date(value)).toString();

  if (options.relative !== undefined) {
    $time.dataset.relative = options.relative;
  }

  if (options.simple !== undefined) {
    $time.dataset.simple = options.simple;
  }

  return $time;
};

FlareTail.util.datetime.update_elements = function () {
  for (let $time of document.querySelectorAll('time')) {
    let data = $time.dataset,
        time = this.format($time.dateTime, {
          'relative': data.relative !== undefined ? data.relative === 'true' : this.options.relative,
          'simple': data.simple !== undefined ? data.simple === 'true' : this.options.simple
        });

    if ($time.textContent !== time) {
      $time.textContent = time;
    }
  }
};

FlareTail.util.datetime.start_updater = function () {
  this.updater = window.setInterval(() => this.update_elements(), this.options.updater_interval * 1000);
};

FlareTail.util.datetime.stop_updater = function () {
  window.clearInterval(this.updater);

  delete this.updater;
};

document.addEventListener('visibilitychange', event => {
  let dt = FlareTail.util.datetime;

  if (!document.hidden && dt.options.relative && dt.options.updater_enabled && !dt.updater) {
    dt.update_elements();
    dt.start_updater();
  } else if (dt.updater) {
    dt.stop_updater();
  }
});

/* ------------------------------------------------------------------------------------------------------------------
 * Network
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.network = {};

FlareTail.util.network.json = (url, data = null) => {
  let xhr = new XMLHttpRequest();

  return new Promise((resolve, reject) => {
    xhr.open(data ? 'POST' : 'GET', url, true);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.addEventListener('load', event => resolve(JSON.parse(event.target.responseText)));
    xhr.addEventListener('error', event => reject(event));
    xhr.send(data);
  });
};

FlareTail.util.network.jsonp = url => {
  let $script = document.body.appendChild(document.createElement('script')),
      callback_id = 'jsonp_' + Date.now(),
      cleanup = () => { $script.remove(); delete window[callback_id]; };

  return new Promise((resolve, reject) => {
    window[callback_id] = data => resolve(data);
    $script.addEventListener('load', event => cleanup());
    $script.addEventListener('error', event => { cleanup(); reject(new Error()); });
    $script.src = url + '?callback=' + callback_id;
  });
};

/* ------------------------------------------------------------------------------------------------------------------
 * History
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.history = {};

/* ------------------------------------------------------------------------------------------------------------------
 * Localization
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.l10n = {};

/* ------------------------------------------------------------------------------------------------------------------
 * Internationalization
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.i18n = {};

/* ------------------------------------------------------------------------------------------------------------------
 * Style
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.style = {};

FlareTail.util.style.get = ($element, property) => window.getComputedStyle($element, null).getPropertyValue(property);

/* ------------------------------------------------------------------------------------------------------------------
 * Object
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.object = {};

FlareTail.util.object.clone = obj => Object.assign({}, obj);

/* ------------------------------------------------------------------------------------------------------------------
 * Array
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.array = {};

FlareTail.util.array.clone = array => [...array];

FlareTail.util.array.join = (set, tag = undefined) => {
  let open_tag = tag ? `<${tag}>` : '',
      close_tag = tag ? `</${tag}>` : '',
      array = [for (item of set) open_tag + FlareTail.util.string.sanitize(item) + close_tag],
      last = array.pop();

  return array.length ? array.join(', ') + ' and ' + last : last; // l10n
};

FlareTail.util.array.sort = (array, cond) => {
  // Normalization: ignore brackets for comparison
  let nomalized_values = new Map(),
      nomalize = str => {
        let value = nomalized_values.get(str);

        if (!value) {
          value = str.replace(/[\"\'\(\)\[\]\{\}<>«»_]/g, '').toLowerCase();
          nomalized_values.set(str, value);
        }

        return value;
      };

  array.sort((a, b) => {
    if (cond.order === 'descending') {
      [a, b] = [b, a]; // reverse()
    }

    let a_val = a.data ? a.data[cond.key] : a[cond.key],
        b_val = b.data ? b.data[cond.key] : b[cond.key];

    if (!a_val || !b_val) {
      return true;
    }

    switch (cond.type) {
      case 'integer': {
        return a_val > b_val;
      }

      case 'boolean': {
        return a_val < b_val;
      }

      case 'time': {
        return new Date(a_val) > new Date(b_val);
      }

      default: {
        return nomalize(a_val) > nomalize(b_val);
      }
    }
  });

  return array;
};

/* ------------------------------------------------------------------------------------------------------------------
 * String
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.util.string = {};

FlareTail.util.string.sanitize = str => {
  let $p = document.createElement('p');

  $p.textContent = str;

  return $p.innerHTML;
};

FlareTail.util.string.strip_tags = str => {
  let $p = document.createElement('p');

  $p.innerHTML = str;

  return $p.textContent;
};
