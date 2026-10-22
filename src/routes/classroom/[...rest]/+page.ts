// CastleClass was first called Classroom (owner, 2026-10-22): old links (/classroom, /classroom/<class>…) still work.
import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, url }) => {
  redirect(308, `/castleclass${params.rest ? `/${params.rest}` : ''}${url.search}`);
};
