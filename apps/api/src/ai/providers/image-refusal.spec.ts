import { ContentSafetyError, ImageRefusedError } from '../content-safety.service';
import { GENTLE_REDRAW_NOTE } from '../gemini-safety';
import { ImageProviderDispatcher } from './image-provider-dispatcher.service';

/** A refusal to draw gets one gentle redraw; a drawn picture our reviewer flags still stops the story. */
describe('ImageProviderDispatcher — image model refusals', () => {
  const settings = { IMAGE_GENERATION_BACKEND: 'gemini', IMAGE_GENERATION_MODEL: 'gemini-test', STORY_IMAGE_ASPECT_RATIO: '1:1' } as Record<string, string>;
  const settingsRepo = { findOne: jest.fn(async ({ where: { key } }: { where: { key: string } }) => (settings[key] ? { key, value: settings[key] } : null)) };
  const ok = { imageUrl: '', imageBase64: 'aGk=' };

  function make(generateImage: jest.Mock, safe = true) {
    const nanoBanana = { generateImage };
    const safety = { checkImage: jest.fn(async () => ({ safe, reasons: safe ? [] : ['nudity'] })) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { dispatcher: new ImageProviderDispatcher(settingsRepo as any, {} as any, nanoBanana as any, safety as any), safety };
  }
  const input = { sceneDescription: 'A boy finds a lamp in the desert', heroName: 'Siddhant', heroAge: 7 };

  it('redraws once with the gentle note after a refusal, and uses that picture', async () => {
    const draw = jest.fn()
      .mockRejectedValueOnce(new ImageRefusedError('image refused by Gemini safety filters (PROHIBITED_CONTENT)'))
      .mockResolvedValueOnce(ok);
    const { dispatcher } = make(draw);
    await expect(dispatcher.generateImage(input)).resolves.toBe(ok);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(draw.mock.calls[1][0].sceneDescription).toContain(GENTLE_REDRAW_NOTE);
  });

  it('gives up with an ImageRefusedError when the gentle redraw is refused too', async () => {
    const refused = new ImageRefusedError('image refused by Gemini safety filters (PROHIBITED_CONTENT)');
    const { dispatcher } = make(jest.fn().mockRejectedValue(refused));
    await expect(dispatcher.generateImage(input)).rejects.toBeInstanceOf(ImageRefusedError);
  });

  it('still stops when a drawn picture fails our child-safety review twice', async () => {
    const { dispatcher } = make(jest.fn().mockResolvedValue(ok), false);
    const err = await dispatcher.generateImage(input).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ContentSafetyError);
    expect(err).not.toBeInstanceOf(ImageRefusedError);
  });
});
