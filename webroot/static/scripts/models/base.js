/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.models = BzDeck.models || {};

/**
 * Define the app's Base Model. This constructor is intended to be inherited by app's each model.
 *
 * @constructor
 * @extends Model
 * @argument {undefined}
 * @return {Object} model - New BaseModel instance.
 */
BzDeck.models.Base = function BaseModel () {};

BzDeck.models.Base.prototype = Object.create(FlareTail.app.Model.prototype);
BzDeck.models.Base.prototype.constructor = BzDeck.models.Base;
