/**
 * The real placement vocabulary the create/edit dialog offers.
 *
 * Units and positions are fetched server-side from the API when the directory page
 * renders, so the form lists the structure the company actually defines. When the
 * fetch fails the page passes `undefined` and the dialog falls back to free-text
 * placement instead of showing an empty picker.
 */
export interface DirectoryOptions {
  /** Departments an employee can sit in; ids are the API's unit ids. */
  readonly units: readonly { readonly id: string; readonly name: string }[];
  /** Active job positions, each optionally tied to one unit. */
  readonly positions: readonly {
    readonly id: string;
    readonly name: string;
    readonly unitId: string | null;
  }[];
}
