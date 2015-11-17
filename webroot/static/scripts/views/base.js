/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views = BzDeck.views || {};
BzDeck.views.pages = {};

/**
 * Define the app's Base View. This constructor is intended to be inherited by each app view.
 *
 * @constructor
 * @extends View
 * @argument {undefined}
 * @return {Object} view - New BaseView instance.
 */
BzDeck.views.Base = function BaseView () {};

BzDeck.views.Base.prototype = Object.create(FlareTail.app.View.prototype);
BzDeck.views.Base.prototype.constructor = BzDeck.views.Base;
