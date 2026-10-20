<script lang="ts">
  /**
   * The owner adds kind words for the /wishes page: the person's name, who they are, their words (paste them as
   * they are: the page makes the paragraphs) and a photo. The preview shows the card as the page will.
   */
  import { onMount } from 'svelte';
  import WishCard from '$lib/components/WishCard.svelte';
  import { adminWishes, deleteWish, saveWish, wishPhoto, wishPhotoUrl, type Wish } from '$lib/wishes';

  let list = $state<Wish[]>([]);
  let loadError = $state('');
  const empty = () => ({ id: undefined as string | undefined, name: '', role: '', text: '', hidden: false, photo: 0 });
  let form = $state(empty());
  /** A new photo (base64 JPEG), or null: the photo is being taken away; undefined: as it is. */
  let newPhoto = $state<string | null | undefined>();
  let busy = $state(false);
  let message = $state('');
  let fileInput: HTMLInputElement | undefined = $state();

  const previewPhoto = $derived(newPhoto ? `data:image/jpeg;base64,${newPhoto}` : undefined);
  const hasPhoto = $derived(newPhoto !== null && (!!newPhoto || form.photo > 0));

  async function load() {
    try {
      list = await adminWishes();
      loadError = '';
    } catch (e) {
      loadError = e instanceof Error ? e.message : 'Could not load.';
    }
  }
  onMount(load);

  async function pick(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    (e.currentTarget as HTMLInputElement).value = '';
    if (!file) return;
    if (file.size > 15_000_000) return void (message = 'That photo is too big (over 15 MB).');
    const b64 = await wishPhoto(file);
    if (!b64) return void (message = "That picture couldn't be used. Try a JPEG or PNG photo.");
    newPhoto = b64;
    message = '';
  }

  function edit(w: Wish) {
    form = { id: w.id, name: w.name, role: w.role, text: w.text, hidden: w.hidden, photo: w.photo };
    newPhoto = undefined;
    message = '';
    scrollTo({ top: 0, behavior: 'smooth' });
  }
  function reset() {
    form = empty();
    newPhoto = undefined;
  }

  async function save(e: Event) {
    e.preventDefault();
    busy = true;
    message = '';
    try {
      const saved = await saveWish({ id: form.id, name: form.name, role: form.role, text: form.text, hidden: form.hidden, photo: newPhoto });
      message = form.id ? `Saved. ${saved.hidden ? 'Hidden from the page.' : 'It is on the Kind words page.'}` : `Added. ${saved.hidden ? 'Hidden from the page for now.' : 'It is on the Kind words page.'}`;
      reset();
      await load();
    } catch (err) {
      message = err instanceof Error ? err.message : 'Could not save. Try again.';
    } finally {
      busy = false;
    }
  }

  async function remove(w: Wish) {
    if (!confirm(`Delete the words from ${w.name}? This cannot be undone.`)) return;
    try {
      await deleteWish(w.id);
      if (form.id === w.id) reset();
      await load();
    } catch (err) {
      message = err instanceof Error ? err.message : 'Could not delete.';
    }
  }
</script>

<section class="card pad">
  <h3 class="title">{form.id ? 'Edit kind words' : 'Add kind words'}</h3>
  <p class="label">Shown on the <a href="/wishes" target="_blank">Kind words page</a>, newest first. Paste the message as it came (WhatsApp, email, letter): the page makes the paragraphs. Add only words and photos the person agreed to share.</p>
  <div class="grid">
    <form onsubmit={save}>
      <label>Name <input bind:value={form.name} maxlength="80" required placeholder="e.g. Abhijit Kunte" /></label>
      <label>Who they are <span class="label">(optional)</span><input bind:value={form.role} maxlength="120" placeholder="e.g. Grandmaster, Pune · Chess coach · Parent" /></label>
      <label>Their words<textarea bind:value={form.text} rows="9" maxlength="6000" required placeholder="Paste the message here…"></textarea></label>
      <div class="photo-row">
        <span>Photo <span class="label">(optional; cut to a square)</span></span>
        <input bind:this={fileInput} type="file" accept="image/*" hidden onchange={pick} />
        <button type="button" class="btn small" onclick={() => fileInput?.click()}>{hasPhoto ? 'Change photo' : 'Upload photo'}</button>
        {#if hasPhoto}<button type="button" class="btn small" onclick={() => (newPhoto = null)}>Remove photo</button>{/if}
      </div>
      <label class="check"><input type="checkbox" bind:checked={form.hidden} /> Hide from the page for now</label>
      <div class="actions">
        <button class="btn primary" disabled={busy || form.name.trim().length < 2 || form.text.trim().length < 2}>{busy ? 'Saving…' : form.id ? 'Save changes' : 'Add to the page'}</button>
        {#if form.id}<button type="button" class="btn" onclick={reset}>Cancel</button>{/if}
      </div>
      {#if message}<p class="msg" role="status">{message}</p>{/if}
    </form>
    <div class="preview">
      <span class="label">Preview</span>
      <WishCard wish={{ id: form.id ?? 'new', name: form.name, role: form.role, text: form.text || 'Their words appear here, in paragraphs.', photo: newPhoto === null ? 0 : form.photo }} photo={previewPhoto} />
    </div>
  </div>
</section>

<section class="saved">
  <h3 class="title">On the page ({list.filter((w) => !w.hidden).length}){#if list.some((w) => w.hidden)} · hidden ({list.filter((w) => w.hidden).length}){/if}</h3>
  {#if loadError}<p class="label">{loadError}</p>{/if}
  {#if !list.length && !loadError}<p class="label">Nothing added yet.</p>{/if}
  {#each list as w (w.id)}
    <div class="row card" class:hidden-row={w.hidden}>
      {#if wishPhotoUrl(w)}<img src={wishPhotoUrl(w)} alt="" width="40" height="40" />{/if}
      <span class="who"><strong>{w.name}</strong>{#if w.role}<span class="label"> · {w.role}</span>{/if}{#if w.hidden}<span class="pill">hidden</span>{/if}<span class="label snippet">{w.text.slice(0, 120)}{w.text.length > 120 ? '…' : ''}</span></span>
      <button class="btn small" onclick={() => edit(w)}>Edit</button>
      <button class="btn small" onclick={() => remove(w)}>Delete</button>
    </div>
  {/each}
</section>

<style>
  .pad {
    padding: 16px;
    margin-bottom: 16px;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 18px;
    margin-top: 12px;
  }
  @media (max-width: 900px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-weight: 600;
    font-size: 14px;
  }
  input:not([type='checkbox']),
  textarea {
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--text);
    padding: 8px 10px;
    font: inherit;
    font-size: 15px;
    font-weight: 400;
  }
  textarea {
    resize: vertical;
    line-height: 1.5;
  }
  .check {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    font-weight: 500;
  }
  .photo-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    font-weight: 600;
    font-size: 14px;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .msg {
    margin: 0;
    font-size: 14px;
  }
  .preview {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .saved {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
  }
  .row img {
    border-radius: 50%;
    object-fit: cover;
    flex: none;
  }
  .row .who {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 6px;
  }
  .snippet {
    flex-basis: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hidden-row {
    opacity: 0.6;
  }
</style>
