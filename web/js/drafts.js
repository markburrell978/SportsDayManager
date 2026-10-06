'use strict';

/** Keep form drafts in memory, scoped to a Sports Day, event, run and category. */
const EventDrafts = {
  drafts: new Map(),
  bindings: [],

  /** Build a collision-free identity for one editable form. */
  key(scope, group) {
    return JSON.stringify([
      scope.sportsDayIdentifier,
      scope.eventIdentifier,
      scope.runIdentifier,
      group.name,
      group.category || '',
    ]);
  },

  /** Read all controls together; absent forms must not erase a stored draft. */
  read(fields, document) {
    const values = {};
    for (const field of fields) {
      const control = document.getElementById(field.identifier);
      if (!control) {
        return null;
      }
      values[field.identifier] = control[field.property];
    }
    return values;
  },

  /** Snapshot changes before controls are replaced by a render. */
  capture(document) {
    for (const binding of this.bindings) {
      const values = this.read(binding.fields, document);
      if (!values) {
        continue;
      }
      if (JSON.stringify(values) === JSON.stringify(binding.baseline)) {
        this.drafts.delete(binding.key);
      } else {
        this.drafts.set(binding.key, {
          signature: binding.signature,
          values,
        });
      }
    }
  },

  /** Bind newly rendered controls, restoring only drafts with matching identities. */
  bind(scope, groups, document) {
    for (const key of this.drafts.keys()) {
      const [sportsDayIdentifier, eventIdentifier, runIdentifier] =
        JSON.parse(key);
      if (
        sportsDayIdentifier === scope.sportsDayIdentifier &&
        eventIdentifier === scope.eventIdentifier &&
        runIdentifier !== scope.runIdentifier
      ) {
        this.drafts.delete(key);
      }
    }
    this.bindings = groups.flatMap((group) => {
      const baseline = this.read(group.fields, document);
      if (!baseline || !group.fields.length) {
        return [];
      }
      const key = this.key(scope, group);
      const signature = JSON.stringify(group.fields);
      const draft = this.drafts.get(key);
      if (draft && draft.signature !== signature) {
        this.drafts.delete(key);
      } else if (draft) {
        for (const field of group.fields) {
          document.getElementById(field.identifier)[field.property] =
            draft.values[field.identifier];
        }
      }
      return [{ ...group, key, signature, baseline }];
    });
  },

  /** Stop reading controls from a view that is no longer rendered. */
  unbind() {
    this.bindings = [];
  },

  /** Report unsaved work without treating a completed, unchanged form as dirty. */
  hasChanges(document) {
    this.capture(document);
    return this.drafts.size > 0;
  },

  /** Report whether the currently bound named form has an unsaved draft. */
  hasDraft(name) {
    return this.bindings.some(
      (binding) => binding.name === name && this.drafts.has(binding.key),
    );
  },

  /** Clear only an acknowledged save and stop the old controls recreating it. */
  accept(name, document) {
    for (const binding of this.bindings) {
      if (binding.name === name) {
        this.drafts.delete(binding.key);
        binding.baseline =
          this.read(binding.fields, document) || binding.baseline;
      }
    }
  },

  /** Discard explicitly, marking old controls clean until they are replaced. */
  discard(document) {
    this.drafts.clear();
    for (const binding of this.bindings) {
      binding.baseline =
        this.read(binding.fields, document) || binding.baseline;
    }
  },
};
