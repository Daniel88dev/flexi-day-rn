/**
 * An in-memory stand-in for `expo-file-system`, enough for the attachment code: files with sizes,
 * folders, copy, delete, list, the document picker and `File#upload`. Mock the module with
 * `jest.mock("expo-file-system", () => jest.requireActual("@/test-support/fake-file-system").fakeFileSystem)`.
 */
const files = new Map<string, number>();
const folders = new Set<string>();

type Part = string | { uri: string };

// As on iOS, a directory's uri ends in a slash and a file's does not.
function join(parts: Part[]): string {
  const raw = parts.map((part) => (typeof part === "string" ? part : part.uri)).join("/");
  const [, scheme = "", rest = raw] = /^(\w+:\/\/)(.*)$/.exec(raw) ?? [];
  return scheme + rest.replace(/\/{2,}/g, "/").replace(/\/$/, "");
}
const lastSegment = (uri: string) => uri.slice(uri.lastIndexOf("/") + 1);
const under = (uri: string, folder: string) => uri.startsWith(`${folder.replace(/\/$/, "")}/`);

const upload = jest.fn(async (_uri: string, _url: string, _options?: unknown) => ({
  status: 200,
  body: "",
  headers: {},
}));
const pickFileAsync = jest.fn();

class FakeFile {
  readonly uri: string;

  constructor(...parts: Part[]) {
    this.uri = join(parts);
  }

  get name() {
    return lastSegment(this.uri);
  }

  get exists() {
    return files.has(this.uri);
  }

  get size() {
    return files.get(this.uri) ?? 0;
  }

  get type() {
    return "";
  }

  async copy(destination: FakeDirectory) {
    if (!files.has(this.uri)) throw new Error(`No file at ${this.uri}`);
    files.set(join([destination, this.name]), files.get(this.uri) ?? 0);
  }

  delete() {
    files.delete(this.uri);
  }

  upload(url: string, options?: unknown) {
    return upload(this.uri, url, options);
  }

  static pickFileAsync = pickFileAsync;
}

class FakeDirectory {
  readonly uri: string;
  private readonly path: string;

  constructor(...parts: Part[]) {
    this.path = join(parts);
    this.uri = `${this.path}/`;
  }

  get name() {
    return lastSegment(this.path);
  }

  get exists() {
    return (
      folders.has(this.path) ||
      [...files.keys(), ...folders].some((entry) => under(entry, this.path))
    );
  }

  create() {
    folders.add(this.path);
  }

  delete() {
    for (const entry of [...files.keys()]) if (under(entry, this.path)) files.delete(entry);
    for (const entry of [...folders])
      if (entry === this.path || under(entry, this.path)) folders.delete(entry);
  }

  list(): (FakeDirectory | FakeFile)[] {
    const children = new Map<string, FakeDirectory | FakeFile>();
    for (const entry of [...files.keys(), ...folders]) {
      if (!under(entry, this.path)) continue;
      const rest = entry.slice(this.path.length + 1);
      const name = rest.split("/")[0];
      const child = `${this.path}/${name}`;
      if (children.has(child)) continue;
      children.set(
        child,
        rest.includes("/") || folders.has(child) ? new FakeDirectory(child) : new FakeFile(child)
      );
    }
    return [...children.values()];
  }
}

export const fakeFileSystem = {
  File: FakeFile,
  Directory: FakeDirectory,
  Paths: { cache: new FakeDirectory("file:///cache") },
  UploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
};

/** The fake's contents and spies, for a test to arrange and inspect. */
export const fakeFiles = {
  upload,
  pickFileAsync,
  put(uri: string, size: number) {
    files.set(uri, size);
  },
  has(uri: string) {
    return files.has(uri);
  },
  /** Every file stored under `folder`. */
  under(folder: string) {
    return [...files.keys()].filter((entry) => under(entry, folder)).sort();
  },
  reset() {
    files.clear();
    folders.clear();
    upload.mockReset();
    upload.mockResolvedValue({ status: 200, body: "", headers: {} });
    pickFileAsync.mockReset();
  },
};
