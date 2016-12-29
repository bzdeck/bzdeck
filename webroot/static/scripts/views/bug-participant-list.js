/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the BugParticipantListView that represents an editable participant list on each Bug Details page, like
 * Assignee, Mentors or Cc.
 * @extends BzDeck.BaseView
 */
BzDeck.BugParticipantListView = class BugParticipantListView extends BzDeck.BaseView {
  /**
   * Get a BugParticipantListView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {Proxy} bug - BugModel instance.
   * @param {HTMLElement} $section - Outer <section> element of the field.
   * @returns {BugParticipantListView} New BugParticipantListView instance.
   */
  constructor (id, bug, $section) {
    super(id); // Assign this.id

    this.bug = bug;
    this.field = $section.dataset.field;

    this.multiple = ['mentor', 'cc'].includes(this.field);
    this.can_take = ['assigned_to', 'qa_contact', 'mentor'].includes(this.field);
    this.can_change = this.field !== 'creator';
    this.can_subscribe = this.field === 'cc';
    this.values = new Set(this.multiple ? this.bug[this.field] : this.bug[this.field] ? [this.bug[this.field]] : []);
    this.my_email = BzDeck.account.data.name;

    this.$section = $section;
    this.$controls = this.$section.querySelector('.controls');
    this.$list = this.$section.querySelector('.list')

    this.remove_empty_person();

    if (this.can_change) {
      this.add_person_finder();
    }

    if (this.can_take) {
      this.add_take_button();
    }

    if (this.can_subscribe) {
      this.add_subscribe_button();
    }

    if (!this.multiple && this.can_change) {
      this.$controls.setAttribute('aria-hidden', !!this.$list.querySelector('[itemscope]'));
    }

    for (const $person of this.$list.querySelectorAll('[itemscope]')) {
      this.add_menu_to_person($person);
    }

    // Subscribe to events
    this.subscribe('BugModel#ParticipantAdded', true);
    this.subscribe('BugModel#ParticipantRemoved', true);
  }

  /**
   * Remove an empty person node on the list. FIXME: This should be handled by the template engine.
   */
  remove_empty_person () {
    const $person = this.$list.querySelector('[itemscope]');

    if ($person && !$person.querySelector('[itemprop="email"]').content) {
      $person.remove();
    }
  }

  /**
   * Add the Take button to the <header> in the <section>.
   * @fires BugView#AddParticipant
   */
  add_take_button () {
    this.$button = this.create_button('take', 'Take', {
      assigned_to: 'Assign myself to this bug',
      qa_contact: 'Take myself the QA Contact of this bug',
      mentor: 'Take myself the mentor of this bug',
    }[this.field]);

    this.$button.setAttribute('aria-hidden', !this.can_take);
    this.$button.setAttribute('aria-disabled', this.values.has(this.my_email));

    this.$button.addEventListener('click', event => {
      this.trigger('BugView#AddParticipant', { field: this.field, email: this.my_email });
    });

    this.$controls.querySelector('.button-outer').appendChild(this.$button);
  }

  /**
   * Add the Subscribe button to the <header> in the <section>.
   * @fires BugView#Unsubscribe
   * @fires BugView#Subscribe
   */
  add_subscribe_button () {
    const listed = this.values.has(this.my_email);
    const label = listed ? 'Unsubscribe' : 'Subscribe';
    const aria_label = listed ? 'Remove myself from the Cc list' : 'Add myself to the Cc list';

    this.$button = this.create_button('subscribe', label, aria_label);

    this.$button.addEventListener('click', event => {
      this.trigger(this.values.has(this.my_email) ? 'BugView#Unsubscribe' : 'BugView#Subscribe');
    });

    this.$controls.querySelector('.button-outer').appendChild(this.$button);
  }

  /**
   * Add a Person Finder under the <header>.
   * @fires BugView#AddParticipant
   */
  add_person_finder () {
    this.$$finder = new BzDeck.PersonFinderView(this.id, `bug-${this.bug.id}-${this.id}-${this.field}-person-finder`,
                                                this.bug, this.values);
    this.$finder = this.$$finder.$combobox;

    this.$finder.addEventListener('Change', event => {
      this.$$finder.clear();
      this.trigger('BugView#AddParticipant', { field: this.field, email: event.detail.$target.dataset.value });
    });

    this.$controls.querySelector('.finder-outer').appendChild(this.$$finder.$combobox);
  }

  /**
   * Called whenever a new participant is added by the user. Add the person to the list.
   * @listens BugModel#ParticipantAdded
   * @param {Number} bug_id - Changed bug ID.
   * @param {String} field - Relevant bug field, like assigned_to or cc.
   * @param {String} email - Email of the added person.
   */
  on_participant_added ({ bug_id, field, email } = {}) {
    if (bug_id !== this.bug.id || field !== this.field) {
      return;
    }

    let $person = this.$list.querySelector('[itemscope]');
    const self = email === this.my_email;

    if (!this.multiple && $person) {
      const email = $person.querySelector('[itemprop="email"]').content;

      this.values.delete(email);
      this.$$finder.exclude.delete(email);

      $person.remove();
    }

    this.values.add(email);
    this.$$finder.exclude.add(email);

    if (this.can_take) {
      this.$button.setAttribute('aria-disabled', this.values.has(this.my_email));
    } else if (self) {
      this.$button.label = this.$button.textContent = 'Unsubscribe';
      this.$button.setAttribute('aria-label', 'Remove myself from the Cc list');
    }

    (async () => {
      const participant = await BzDeck.collections.users.get(email, { name: email });

      $person = this.fill(this.get_template('bug-participant'), participant.properties);
      $person.setAttribute('itemprop', this.field);
      this.$list.insertAdjacentElement('afterbegin', $person);
      this.add_menu_to_person($person);
    })();

    if (!this.multiple && this.can_change) {
      this.$controls.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Called whenever a new participant is removed by the user. Remove the person from the list.
   * @listens BugModel#ParticipantRemoved
   * @param {Number} bug_id - Changed bug ID.
   * @param {String} field - Relevant bug field, like assigned_to or cc.
   * @param {String} email - Email of the removed person.
   */
  on_participant_removed ({ bug_id, field, email } = {}) {
    if (bug_id !== this.bug.id || field !== this.field) {
      return;
    }

    const $email = this.$list.querySelector(`[itemprop="email"][content="${email}"]`);
    const $person = $email ? $email.closest('[itemscope]') : undefined;
    const self = email === this.my_email;

    if (!$person) {
      return;
    }

    this.values.delete(email);
    this.$$finder.exclude.delete(email);

    // Add a simple animation effect on removing participants
    $person.classList.add('removing');
    $person.addEventListener('transitionend', event => {
      $person.remove();

      if (this.can_take) {
        this.$button.setAttribute('aria-disabled', this.values.has(this.my_email));
      } else if (self) {
        this.$button.label = this.$button.textContent = 'Subscribe';
        this.$button.setAttribute('aria-label', 'Add myself to the Cc list');
      }
    }, { once: true });

    if (!this.multiple && this.can_change) {
      this.$controls.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Create a new button widget.
   * @param {String} command - Description of the button's action.
   * @param {String} text - Text used for the label and tooltip on the button.
   * @param {String} label - Text used for the aria-label attribute.
   * @returns {HTMLElement} $button
   */
  create_button (command, text, label) {
    const $button = document.createElement('span');

    $button.tabIndex = 0;
    $button.textContent = text;
    $button.title = text;
    $button.dataset.command = command;
    $button.setAttribute('role', 'button');
    $button.setAttribute('aria-label', label);

    return $button;
  }

  /**
   * Add drop down menu to each person.
   * @param {HTMLElement} $person - Person on the list.
   * @fires BugView#RemoveParticipant
   * @fires BugView#AddParticipant
   */
  add_menu_to_person ($person) {
    const email = $person.querySelector('[itemprop="email"]').content;
    const name = $person.querySelector('[itemprop="name"]').textContent;
    const $$button = new FlareTail.widgets.Button($person);
    let $$menu;

    $$button.bind('Pressed', event => {
      if (!$$menu) {
        $$menu = this.build_menu(email);

        const $menu = $$menu.view.$container;

        $person.appendChild($menu);
        $person.setAttribute('aria-owns', $menu.id);

        $$menu.bind('MenuOpened', event => {
          // Check for the bug's properties and changes, and disable a menuitem if the person is in the field
          for (const field of ['assigned_to', 'qa_contact', 'mentor', 'cc']) {
            let $menuitem = $menu.querySelector(`[data-command="add"][data-prop=${field}]`);
            let bug_has = field === 'cc' ? this.bug.cc === email : (this.bug[field] || []).includes(email);
            let change_has = (field === 'cc' && this.bug.changes.cc === email) ||
                (this.bug.changes[field] && this.bug.changes[field].add && this.bug.changes[field].add.includes(email));

            if ($menuitem) {
              $menuitem.setAttribute('aria-disabled', (bug_has || change_has));
            }
          }
        });

        $$menu.bind('MenuItemSelected', event => {
          const func = {
            remove: () => this.trigger('BugView#RemoveParticipant', { field: this.field, email }),
            add: () => this.trigger('BugView#AddParticipant', { field: event.detail.target.dataset.prop, email }),
            profile: () => BzDeck.router.navigate(`/profile/${email}`),
          }[event.detail.command]();
        });
      }

      $$menu.bind('MenuClosed', event => $person.setAttribute('aria-pressed', 'false'));

      if (event.detail.pressed) {
        $$menu.open();
      } else {
        $$menu.close();
      }
    });
  }

  /**
   * Create a menu for a person.
   * @param {String} email - Email of the person.
   * @returns {Menu} Menu widget.
   */
  build_menu (email) {
    const menu_data = [];
    const $menu = document.createElement('ul');

    $menu.id = FlareTail.util.Misc.hash(7, true);
    $menu.setAttribute('role', 'menu');
    $menu.setAttribute('aria-expanded', 'false');

    menu_data.push({ id: `${$menu.id}-email`, label: email, disabled: true });
    menu_data.push({ id: `${$menu.id}-profile`, label: 'View Profile', data: { command: 'profile' }});
    menu_data.push({ type: 'separator' });

    if (this.field !== 'creator') {
      menu_data.push({
        id: `${$menu.id}-remove`,
        label: {
          assigned_to: `Unassign from this bug`,
          qa_contact: `Remove from QA Contact`,
          mentor: `Remove from Mentors`,
          cc: `Remove from Cc list`,
        }[this.field],
        data: { command: 'remove', prop: this.field },
      });

      menu_data.push({ type: 'separator' });
    }

    for (const field of ['assigned_to', 'qa_contact', 'mentor', 'cc']) {
      if (this.field !== field) {
        menu_data.push({
          id: `${$menu.id}-add-${field}`,
          label: {
            assigned_to: `Assign to this bug`,
            qa_contact: `Add to QA Contact`,
            mentor: `Add to Mentors`,
            cc: `Add to Cc list`,
          }[field],
          data: { command: 'add', prop: field },
        });
      }
    }

    return new FlareTail.widgets.Menu($menu, menu_data);
  }
}
