"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ramda_1 = __importDefault(require("ramda"));
async function retrievePage(model, params, options = {}) {
    const transform = options.transform || ((document) => document.toJSON());
    const sortDirection = options.sortDirection || -1;
    const cursorKey = options.cursorKey || 'cursor';
    const limit = Math.min(params.first || 1000, 1000);
    const filter = Object.assign({}, (params.filter || {}));
    let totalCount;
    if (options.totalCount || ramda_1.default.isNil(options.totalCount)) {
        totalCount = await model.countDocuments(filter);
    }
    const cursorCriteria = (field) => ({
        [sortDirection === 1 ? '$gt' : '$lt']: Buffer.from(field, 'base64'),
    });
    const addCursorFilter = (initialFilter, after) => {
        if (initialFilter.$and) {
            return [{ [cursorKey]: cursorCriteria(after) }, ...initialFilter.$and];
        }
        return Object.assign({}, initialFilter, { [cursorKey]: cursorCriteria(after) });
    };
    let query = ramda_1.default.clone(filter);
    if (params.after) {
        query = addCursorFilter(filter, params.after);
    }
    const documents = await model
        .find(query)
        .limit(limit)
        .sort({ [cursorKey]: sortDirection });
    const edges = await Promise.all(ramda_1.default.map(async (item) => ({
        node: await transform(item),
        cursor: ramda_1.default.prop(cursorKey)(item).toString('base64'),
    }))(documents));
    const endCursor = edges.length > 0
        ? ramda_1.default.prop('cursor')(ramda_1.default.last(edges))
        : null;
    let hasNextPage = false;
    if (edges.length >= limit && endCursor) {
        hasNextPage =
            (await model
                .countDocuments(addCursorFilter(filter, endCursor))
                .limit(1)
                .sort({ [cursorKey]: sortDirection })) > 0;
    }
    return {
        totalCount,
        edges,
        pageInfo: {
            endCursor,
            hasNextPage,
        },
    };
}
exports.default = retrievePage;
//# sourceMappingURL=index.js.map