/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.datasources = BzDeck.datasources || {};

BzDeck.datasources.Base = function BaseDataSource () {};
BzDeck.datasources.Base.prototype = Object.create(FlareTail.app.DataSource.IndexedDB.prototype);
BzDeck.datasources.Base.prototype.constructor = BzDeck.datasources.Base;
