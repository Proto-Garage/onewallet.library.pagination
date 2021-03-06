import { Model, Document, FilterQuery } from 'mongoose';
import R from 'ramda';
import { Logger } from 'highoutput-utilities';

const logger = new Logger(['pagination']);

export const EmptyPage = {
  edges: [],
  totalCount: 0,
  pageInfo: {
    endCursor: null,
    hasNextPage: false,
  },
};

export default async function retrievePage<
  TNode = object,
  TDocument extends Document = Document
>(
  model: Model<TDocument, {}>,
  params: {
    first?: number | null;
    after?: Buffer | null;
    filter?: FilterQuery<TDocument>;
  },
  options: {
    cursorKey?: string;
    sortDirection?: 'ASC' | 'DESC';
    transform?: (document: TDocument) => TNode | Promise<TNode>;
    totalCount?: boolean;
  } = {}
): Promise<{
  totalCount?: number;
  edges: { cursor: Buffer; node: TNode }[];
  pageInfo: {
    endCursor: Buffer | null;
    hasNextPage: boolean;
  };
}> {
  const transform =
    options.transform || ((document: Document) => document.toJSON());

  // eslint-disable-next-line no-nested-ternary
  const sortDirection = options.sortDirection === 'ASC' ? 1 : -1;

  const cursorKey = options.cursorKey || 'cursor';

  const limit = params.first || 1000;

  const filter = {
    ...(params.filter || {}),
  };

  let totalCount: number | undefined;
  if (options.totalCount || R.isNil(options.totalCount)) {
    totalCount = await model.countDocuments(filter);
  }

  const cursorCriteria = (
    field: Buffer
  ): {
    [key: string]: Buffer;
  } => ({
    [sortDirection === 1 ? '$gt' : '$lt']: field,
  });

  const addCursorFilter = (
    initialFilter: FilterQuery<TDocument>,
    after: Buffer
  ): FilterQuery<{}> => {
    if (initialFilter.$and) {
      return {
        $and: [...initialFilter.$and, { [cursorKey]: cursorCriteria(after) }],
      };
    }

    return {
      ...initialFilter,
      [cursorKey]: cursorCriteria(after),
    };
  };

  let query = R.clone(filter);

  if (params.after) {
    query = addCursorFilter(filter, params.after);
  }

  const sort = { [cursorKey]: sortDirection };
  logger.silly({ query, limit, sort });

  const documents = await model.find(query).limit(limit).sort(sort);

  const getCursor = R.path<Buffer>(cursorKey.split('.'));

  const edges = await Promise.all(
    R.map<TDocument, Promise<{ node: TNode; cursor: Buffer }>>(
      async (item) => ({
        node: await transform(item),
        cursor: getCursor(item) as Buffer,
      })
    )(documents)
  );

  const endCursor =
    edges.length > 0
      ? R.prop('cursor')(R.last(edges) as { cursor: Buffer })
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
