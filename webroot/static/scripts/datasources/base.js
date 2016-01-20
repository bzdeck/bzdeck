/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.datasources = BzDeck.datasources || {};

/**
 * Define the app's Base DataSource. This constructor is intended to be inherited by the app's each datasource.
 * @extends FlareTail.app.DataSource.IndexedDB
 */
BzDeck.BaseDataSource = class BaseDataSource extends FlareTail.app.DataSource.IndexedDB {}
