/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.presenters = BzDeck.presenters || {};

/**
 * Define the app's Base Presenter. This constructor is intended to be inherited by each app presenter.
 * @abstract
 * @extends FlareTail.app.Presenter
 * @todo Move this to the worker thread.
 */
BzDeck.BasePresenter = class BasePresenter extends FlareTail.app.Presenter {}
