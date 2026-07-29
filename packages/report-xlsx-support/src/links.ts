/** Spreadsheet URLs are data. Only explicit web/mail/phone/internal targets can
 * become active links in either output; executable/file protocols stay inert.
 */
export function safeReportLink(value: string | undefined): string | undefined {
    if (!value)
        return undefined;
    const url = value.trim();
    if (/[\x00-\x1f\x7f]/.test(url))
        return undefined;
    if (url.startsWith("#") && !url.includes("#REF!"))
        return url;
    if (/^(https?:\/\/|mailto:|tel:)/i.test(url))
        return url;
    return undefined;
}
