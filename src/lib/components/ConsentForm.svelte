<script lang="ts">
  /**
   * The consent questions, shown in the sign-in box and, once, to people who were signed in before it
   * existed: are you 18 or older (or under 18 with a parent's agreement), and do you agree to the terms
   * and privacy policy. `age` and `agreed` are read by the parent, which decides when to continue.
   */
  import type { AgeGroup } from '$lib/consent';

  let {
    age = $bindable(),
    agreed = $bindable(false),
    showErrors = false,
  }: { age?: AgeGroup; agreed?: boolean; showErrors?: boolean } = $props();
</script>

<fieldset class="consent" class:bad={showErrors && (!age || !agreed)}>
  <legend class="label">Before you start</legend>
  <ul class="keeps">
    <li>We keep your <strong>name, photo, games, ratings and study progress</strong> so they follow you to every device.</li>
    <li>Only <strong>friends you accept</strong> can message you or see your photo. No ads, and we never sell your data.</li>
    <li>You can ask us to <strong>see or delete</strong> your data at any time.</li>
  </ul>

  <div class="age" role="radiogroup" aria-label="Your age">
    <label class:on={age === 'adult'}>
      <input type="radio" name="age" value="adult" bind:group={age} />
      <span>I am <strong>18 or older</strong></span>
    </label>
    <label class:on={age === 'minor'}>
      <input type="radio" name="age" value="minor" bind:group={age} />
      <span>I am <strong>under 18</strong>, and my parent or guardian has read this and agrees</span>
    </label>
  </div>
  {#if showErrors && !age}<p class="err" role="alert">Please choose one.</p>{/if}

  <label class="agree" class:on={agreed}>
    <input type="checkbox" bind:checked={agreed} />
    <span>I agree to the <a href="/legal/terms" target="_blank" rel="noopener">Terms of use</a> and the <a href="/legal/privacy" target="_blank" rel="noopener">Privacy policy</a>.</span>
  </label>
  {#if showErrors && !agreed}<p class="err" role="alert">Please tick the box to agree.</p>{/if}
</fieldset>

<style>
  .consent {
    width: 100%;
    margin: 0;
    padding: 12px 12px 10px;
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--raised);
    display: flex;
    flex-direction: column;
    gap: 8px;
    text-align: left;
  }
  .consent.bad {
    border-color: var(--loss);
  }
  legend {
    padding: 0 6px;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-size: 11.5px;
  }
  .keeps {
    margin: 0;
    padding-left: 18px;
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--text-2);
  }
  .keeps li + li {
    margin-top: 3px;
  }
  .age {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .age label,
  .agree {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: var(--card);
    font-size: 13.5px;
    line-height: 1.4;
    cursor: pointer;
  }
  .age label.on,
  .agree.on {
    border-color: var(--accent);
  }
  input {
    flex: none;
    width: 20px;
    height: 20px;
    margin: 1px 0 0;
    accent-color: var(--accent);
    cursor: pointer;
  }
  a {
    color: var(--accent);
    text-decoration: underline;
  }
  .err {
    margin: 0;
    color: var(--loss);
    font-size: 12.5px;
    font-weight: 600;
  }
</style>
