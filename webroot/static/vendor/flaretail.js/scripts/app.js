/**
 * FlareTail App Framework
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

'use strict';

let FlareTail = FlareTail || {};

FlareTail.app = {};

/* ------------------------------------------------------------------------------------------------------------------
 * Router
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.app.Router = function Router (app) {
  // Specify the base URL of the app, without a trailing slash
  this.root = app.config.app.root.match(/(.*)\/$/)[1] || '';
  // Specify the launch path
  this.launch_path = app.config.app.launch_path || app.config.app.root || '/';
  // Retrieve routes from app components
  this.routes = new Map([for (component of Iterator(app.controllers)) if ('route' in component[1])
                          [new RegExp('^' + this.root + component[1].route + '$'), component[1]]]);

  window.addEventListener('popstate', event => this.locate());
};

FlareTail.app.Router.prototype.locate = function (path = location.pathname) {
  for (let [re, constructor] of this.routes) {
    let match = path.match(re);

    if (match) {
      new constructor(...match.slice(1));

      return;
    }
  }

  // Couldn't find a route; go to the launch path
  this.navigate(this.launch_path);
};

FlareTail.app.Router.prototype.navigate = function (path, state = {}, replace = false) {
  state.previous = replace && history.state && history.state.previous ? history.state.previous : location.pathname;

  let args = [state, 'Loading...', this.root + path]; // l10n

  replace ? history.replaceState(...args) : history.pushState(...args);
  window.dispatchEvent(new PopStateEvent('popstate'));
};

/* ------------------------------------------------------------------------------------------------------------------
 * Events
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.app.Events = function Events () {};

FlareTail.app.Events.prototype = Object.create(Object.prototype);
FlareTail.app.Events.prototype.constructor = FlareTail.app.Events;

// Publish
FlareTail.app.Events.prototype.trigger = function (topic, data = {}) {
  if (topic.match(/^:/)) {
    topic = this.constructor.name + topic;
    topic += this.id ? ':' + this.id : '';
  }

  FlareTail.util.event.trigger(window, topic, { 'detail': data });
};

// Subscribe
FlareTail.app.Events.prototype.on = function (topic, callback) {
  if (topic.match(/^[VC]:/)) {
    topic = topic.replace(/^V:/, this.constructor.name.replace(/(.*)Controller$/, '$1View:'));
    topic = topic.replace(/^C:/, this.constructor.name.replace(/(.*)View$/, '$1Controller:'));
    topic += this.id ? ':' + this.id : '';
  }

  window.addEventListener(topic, event => callback(event.detail));
};

/* ------------------------------------------------------------------------------------------------------------------
 * Model
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.app.Model = function Model () {};

FlareTail.app.Model.prototype = Object.create(FlareTail.app.Events.prototype);
FlareTail.app.Model.prototype.constructor = FlareTail.app.Model;

/* ------------------------------------------------------------------------------------------------------------------
 * View
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.app.View = function View () {};

FlareTail.app.View.prototype = Object.create(FlareTail.app.Events.prototype);
FlareTail.app.View.prototype.constructor = FlareTail.app.View;

FlareTail.app.View.prototype.get_fragment = FlareTail.util.content.get_fragment;
FlareTail.app.View.prototype.fill = FlareTail.util.content.fill;
FlareTail.app.View.prototype.widget = FlareTail.widget;

/* ------------------------------------------------------------------------------------------------------------------
 * Controller
 * ------------------------------------------------------------------------------------------------------------------ */

FlareTail.app.Controller = function Controller () {};

FlareTail.app.Controller.prototype = Object.create(FlareTail.app.Events.prototype);
FlareTail.app.Controller.prototype.constructor = FlareTail.app.Controller;

/* ------------------------------------------------------------------------------------------------------------------
 * Auto Activation
 * ------------------------------------------------------------------------------------------------------------------ */

window.addEventListener('DOMContentLoaded', event => {
  let app = window[document.querySelector('meta[name="application-name"]').content];

  // Activate router
  app.router = new FlareTail.app.Router(app);
});
