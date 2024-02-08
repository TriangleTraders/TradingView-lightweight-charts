import { ensureNever } from '../../helpers/assertions';
export function defaultTickMarkFormatter(timePoint, tickMarkType, locale) {
    const formatOptions = {};
    switch (tickMarkType) {
        case 0 /* TickMarkType.Year */:
            formatOptions.year = 'numeric';
            break;
        case 1 /* TickMarkType.Month */:
            formatOptions.month = 'short';
            break;
        case 2 /* TickMarkType.DayOfMonth */:
            formatOptions.day = 'numeric';
            break;
        case 3 /* TickMarkType.Time */:
            formatOptions.hour12 = false;
            formatOptions.hour = '2-digit';
            formatOptions.minute = '2-digit';
            break;
        case 4 /* TickMarkType.TimeWithSeconds */:
            formatOptions.hour12 = false;
            formatOptions.hour = '2-digit';
            formatOptions.minute = '2-digit';
            formatOptions.second = '2-digit';
            break;
        default:
            ensureNever(tickMarkType);
    }
    const date = timePoint._internal_businessDay === undefined
        ? new Date(timePoint._internal_timestamp * 1000)
        : new Date(Date.UTC(timePoint._internal_businessDay.year, timePoint._internal_businessDay.month - 1, timePoint._internal_businessDay.day));
    // from given date we should use only as UTC date or timestamp
    // but to format as locale date we can convert UTC date to local date
    const localDateFromUtc = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds());
    return localDateFromUtc.toLocaleString(locale, formatOptions);
}
