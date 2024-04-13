import { useCallback, useRef, useState } from "react";
import "./App.css";
import "@smastrom/react-rating/style.css";

import Papa from "papaparse";
import { useHotkeys } from "react-hotkeys-hook";
import { Rating } from "@smastrom/react-rating";

type AskLLMRecord = {
  id: string;
  text: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isAskLLMRecord(obj: any): obj is AskLLMRecord {
  return (
    obj &&
    typeof obj === "object" &&
    typeof obj.id === "string" &&
    typeof obj.text === "string"
  );
}

function App() {
  const [csvUrl, setCsvUrl] = useState<string>("");
  const [corpusRecords, setCorpusRecords] = useState<AskLLMRecord[] | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setIsLoading(true);
      setError(null);

      let response;
      try {
        response = await fetch(csvUrl);
        if (!response.body) {
          throw new Error("No response body");
        }
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setIsLoading(false);
      }
      if (!response) {
        return;
      }

      const csv = await response.text();
      const data = Papa.parse(csv, { header: true }).data;
      setCorpusRecords(data.filter(isAskLLMRecord));
    },
    [csvUrl]
  );

  return (
    <>
      <h1>Ask-LLM Annotation Helper</h1>
      <Usage />
      <form className="corpus-load-form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={csvUrl}
          onChange={(e) => setCsvUrl(e.target.value)}
        />
        <button disabled={isLoading} type="submit">
          {isLoading ? "Loading..." : "Load"}
        </button>
        <div>{error?.message}</div>
      </form>
      {corpusRecords && <CorpusRecords data={corpusRecords} />}
    </>
  );
}

const Usage = () => {
  return (
    <div>
      <h2>使い方</h2>
      <ol>
        <li>
          CSVファイルのURLを入力してLoadをクリックしてください
          <ul>
            <li>画面上にCSVファイルのテキストが表示されます。</li>
          </ul>
        </li>
        <li>
          テキストごとに点数を付けてください
          <ul>
            <li>
              テキストの下部の★ボタンをクリックすると1〜5の点数が付けられます。
            </li>
            <li>
              テキストにマウスを乗せると選択状態（背景がグレーになった状態）になります。
              この状態で<kbd>a</kbd>, <kbd>s</kbd>, <kbd>d</kbd>, <kbd>f</kbd>,{" "}
              <kbd>g</kbd>のいずれかを押すと、1〜5の点数が付けられます。
            </li>
          </ul>
        </li>
        <li>
          点数をスプレッドシートに転記してください
          <ol>
            <li>
              すべてのテキストに点数を付けたら、ページ最下部のCopyボタンをクリックしてください。点数がクリップボードにコピーされます。
            </li>
            <li>
              スプレッドシートの「データ」シートのC2セルでCtrl+Vを押してください。
            </li>
          </ol>
        </li>
      </ol>
    </div>
  );
};

const CorpusRecords = ({ data }: { data: AskLLMRecord[] }) => {
  const [focusIndex, setFocusIndex] = useState<number>(0);
  const ref = useRef<HTMLDivElement>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const scrollIntoView = useCallback(
    (index: number) => {
      if (ref.current) {
        ref.current.children[index].scrollIntoView();
      }
    },
    [ref]
  );
  useHotkeys(
    "j",
    () => {
      setFocusIndex((currentIndex) => {
        const nextIndex = Math.min(data.length - 1, currentIndex + 1);
        scrollIntoView(nextIndex);
        return nextIndex;
      });
    },
    [data]
  );
  useHotkeys(
    "k",
    () => {
      setFocusIndex((currentIndex) => {
        const nextIndex = Math.max(0, currentIndex - 1);
        scrollIntoView(nextIndex);
        return nextIndex;
      });
    },
    [data]
  );
  ["a", "s", "d", "f", "g"].forEach((key, index) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useHotkeys(
      key,
      () => {
        setRatings((ratings) => {
          const newRatings = { ...ratings };
          newRatings[focusIndex] = index + 1;
          return newRatings;
        });
      },
      [focusIndex]
    );
  });
  const handleMouseEnter = (index: number) => {
    setFocusIndex(index);
  };
  const handleRate = (index: number, rating: number) => {
    setRatings((ratings) => {
      const newRatings = { ...ratings };
      newRatings[index] = rating;
      return newRatings;
    });
  };

  return (
    <div ref={ref}>
      {data.map(({ id, text }, index) => {
        return (
          <CorpusRecord
            key={id}
            className={focusIndex === index ? "focused" : ""}
            onMouseEnter={() => handleMouseEnter(index)}
            onRate={(rating) => handleRate(index, rating)}
            recordId={id}
            rowNumber={index + 2}
            text={text}
            rating={ratings[index]}
          />
        );
      })}
      <Export ratings={ratings} data={data} />
    </div>
  );
};

type CorpusDataProps = {
  rowNumber: number;
  recordId: string;
  text: string;
  className: string;
  onMouseEnter: () => void;
  onRate: (rating: number) => void;
  rating: number;
};

const CorpusRecord = ({
  rowNumber,
  recordId,
  text,
  className,
  onMouseEnter,
  onRate,
  rating,
}: CorpusDataProps) => {
  return (
    <div className={`corpus-record ${className}`} onMouseEnter={onMouseEnter}>
      <span className="corpus-metadata">
        Row: {rowNumber}, ID: {recordId}
      </span>
      <div className="corpus-text">{text}</div>
      <div className="corpus-rating">
        <Rating style={{ maxWidth: 180 }} value={rating} onChange={onRate} />
      </div>
    </div>
  );
};

const Export = ({
  ratings,
  data,
}: {
  ratings: Record<string, number>;
  data: AskLLMRecord[];
}) => {
  const unlatedRecords = Object.keys(data).filter((key) => !ratings[key]);
  const handleClickExportButton = useCallback(() => {
    const exportData = Object.keys(data)
      .map((key) => ratings[key] || "")
      .join("\n");
    navigator.clipboard.writeText(exportData);
  }, [ratings, data]);
  return (
    <div className="export">
      {unlatedRecords.length > 0 && (
        <p className="warn">
          未入力のデータがあります。
          <br />
          {unlatedRecords.map((key) => `ID: ${data[+key].id}`).join(", ")}
        </p>
      )}
      <button onClick={handleClickExportButton}>Copy</button>
    </div>
  );
};

export default App;
