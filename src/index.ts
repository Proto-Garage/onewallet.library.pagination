import { Model, Document } from 'mongoose';
import R from 'ramda';

export default async function retrievePage<TNode = object>(
  model: Model<Document, {}>,
  params: {
    first?: number;
    after?: string;
    filter?: {
      [key: string]: any;
    };
  },
  options: {
    cursorKey?: string;
    sortDirection?: 1 | -1;
    transform?: <TDocument = Document>(
      document: TDocument
    ) => TNode | Promise<TNode>;
  } = {}
): Promise<{
  totalCount: number;
  edges: { cursor: string; node: TNode }[];
  pageInfo: {
    endCursor: string | null;
    hasNextPage: boolean;
  };
}> {
  const transform =
    options.transform || ((document: Document) => document.toJSON());

  const sortDirection = options.sortDirection || -1;

  const cursorKey = options.cursorKey || 'cursor';

  const limit = Math.min(params.first || 1000, 1000);

  const filter = {
    ...(params.filter || {}),
  };

  const totalCount = await model.countDocuments(filter);

  const cursorCriteria = (
    field: string
  ): {
    [key: string]: Buffer;
  } => ({
    [sortDirection === 1 ? '$gt' : '$lt']: Buffer.from(field, 'base64'),
  });

  const addCursorFilter = (
    initialFilter: { [key: string]: any },
    after: string
  ): { [key: string]: any } => {
    if (initialFilter.$and) {
      return [{ [cursorKey]: cursorCriteria(after) }, ...initialFilter.$and];
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

  const documents = await model
    .find(query)
    .limit(limit)
    .sort({ [cursorKey]: sortDirection });

  const edges = await Promise.all(
    R.map<Document, Promise<{ node: TNode; cursor: string }>>(async item => ({
      node: await transform(item),
      cursor: (R.prop(cursorKey)(item as any) as Buffer).toString('base64'),
    }))(documents)
  );

  const endCursor =
    edges.length > 0
      ? R.prop('cursor')(R.last(edges) as { cursor: string })
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
