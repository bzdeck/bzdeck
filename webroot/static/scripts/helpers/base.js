/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.helpers = BzDeck.helpers || {};

BzDeck.helpers.Base = function BaseHelper () {};
BzDeck.helpers.Base.prototype = Object.create(FlareTail.app.Helper.prototype);
BzDeck.helpers.Base.prototype.constructor = BzDeck.helpers.Base;
