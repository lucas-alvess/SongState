import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_BOARD, ScaleBoard, type BoardState } from '../components/ScaleBoard';
import { PageHeader } from '../components/ui';
import { useLocalStorage } from '../lib/storage';

export function Explorer() {
  const [state, setStateRaw] = useLocalStorage<BoardState>('ss.board', DEFAULT_BOARD);
  const [params, setParams] = useSearchParams();
  const setState = useCallback((patch: Partial<BoardState>) => setStateRaw((s) => ({ ...s, ...patch })), [setStateRaw]);

  // links de estudos: #/?root=9&scale=minor-pent&pos=0
  useEffect(() => {
    if (!params.has('scale')) return;
    const pos = params.get('pos');
    setState({
      root: +(params.get('root') ?? 0),
      scaleId: params.get('scale')!,
      pos: pos === null ? null : +pos,
      degrees: [],
    });
    setParams({}, { replace: true });
  }, [params, setParams, setState]);

  return (
    <>
      <PageHeader title="Braço" sub="Explore escalas, shapes e notas. Use os filtros para focar no que está memorizando." />
      <ScaleBoard state={state} setState={setState} />
    </>
  );
}
