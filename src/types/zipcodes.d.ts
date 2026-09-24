declare module 'zipcodes' {
  export function lookup(zip: string):
    | {
        zip: string;
        latitude: number;
        longitude: number;
        /** Two-letter state code; used to derive the adopter's state (#331). */
        state?: string;
      }
    | undefined;
}
