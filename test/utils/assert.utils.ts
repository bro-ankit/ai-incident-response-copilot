export class AssertUtils {
  static assertError = async (callback: () => Promise<any>, message: string, status?: number): Promise<unknown> => {
    const promise = callback();

    await expect(promise).rejects.toThrow();

    const error: unknown = await promise.catch((error: unknown) => {
      expect(error).toHaveProperty('message', message);
      if (status) {
        expect(error).toHaveProperty('status', status);
      }
      return error;
    });

    return error;
  };
}
