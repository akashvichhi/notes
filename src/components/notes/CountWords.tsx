import { Tooltip } from "flowbite-react";
import { useMemo } from "react";
import { getWordsLength, trimHTML } from "../../utils/utils";

interface CountWords {
  selectedText: string;
  notes: string;
}

const CountWords = ({ selectedText, notes }: CountWords) => {
  const trimmedNotes = useMemo(() => trimHTML(notes), [notes]);
  const totalCharacters = useMemo(() => trimmedNotes.length, [trimmedNotes]);
  const totalWords = useMemo(
    () => getWordsLength(trimmedNotes),
    [trimmedNotes],
  );

  const totalSelectedCharacters = useMemo(
    () => selectedText?.length ?? 0,
    [selectedText],
  );
  const totalSelectedWords = useMemo(
    () => getWordsLength(selectedText ?? ""),
    [selectedText],
  );

  return (
    <div className="flex">
      {selectedText && (
        <div className="flex mr-2">
          (<span className="mr-2">Selected:</span>
          <div className="flex gap-2">
            <Tooltip
              content={`Selected characters: ${totalSelectedCharacters}`}
            >
              <span>C: {totalSelectedCharacters}</span>
            </Tooltip>
            <Tooltip content={`Selected words: ${totalSelectedWords}`}>
              <span>W: {totalSelectedWords}</span>
            </Tooltip>
          </div>
          )
        </div>
      )}
      <Tooltip content={`Total characters: ${totalCharacters}`}>
        <span className="mr-2">C: {totalCharacters}</span>
      </Tooltip>
      <Tooltip content={`Total words: ${totalWords}`}>
        <span className="mr-4">W: {totalWords}</span>
      </Tooltip>
    </div>
  );
};

export default CountWords;
