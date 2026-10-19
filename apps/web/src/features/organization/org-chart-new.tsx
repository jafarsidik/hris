'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/toast';
import { ChevronDown, ChevronRight, Search, Minus, Plus, Maximize, X } from 'lucide-react';

/** One node in the org chart tree. */
interface OrgNode {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly department: string;
  readonly children: readonly OrgNode[];
  readonly parent: OrgNode | null;
  readonly level: number;
  readonly email: string;
  readonly location: string;
  readonly hue: number;
}

/** Department color map (same hues as mockup). */
const DEPARTMENT_HUES: Record<string, number> = {
  Eksekutif: 215,
  'Teknologi Informasi': 255,
  Keuangan: 150,
  Operasional: 35,
  SDM: 325,
  Pemasaran: 175,
  Pengadaan: 12,
  Legal: 195,
};

const LOCATIONS = ['Jakarta', 'Surabaya', 'Medan', 'Makassar'];

/** Generate a deterministic avatar SVG data-URI from hue. */
function avatarDataUri(hue: number): string {
  const skin = ['#f1c9a5', '#d9a37c', '#b97c55', '#8d5a3b'][hue % 4];
  const hair = ['#1c1a1a', '#3b2a20', '#5a3a24'][hue % 3];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hue},55%,84%)"/>
        <stop offset="1" stop-color="hsl(${hue + 50},50%,68%)"/>
      </linearGradient>
    </defs>
    <rect width="120" height="120" fill="url(#g)"/>
    <path d="M16 122c2-25 19-39 44-39s42 14 44 39z" fill="hsl(${hue},42%,38%)"/>
    <rect x="51" y="64" width="18" height="20" rx="7" fill="${skin}"/>
    <ellipse cx="60" cy="50" rx="17" ry="20" fill="${skin}"/>
    <path d="M42 49c-2-17 7-27 18-27s20 10 18 27c-3-9-9-12-18-12s-15 3-18 12z" fill="${hair}"/>
  </svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/** Raw node for building the tree. */
interface RawNode {
  name: string;
  title: string;
  department: string;
  children?: RawNode[];
}

/** Build the demo hierarchy. Returns root node and a flat map of all nodes by ID. */
function buildDemoHierarchy(): { root: OrgNode; nodeMap: Map<string, OrgNode> } {
  let counter = 0;
  const nodeMap = new Map<string, OrgNode>();

  function walk(node: RawNode, parentNode: OrgNode | null, level: number): OrgNode {
    const id = `EMP-${String(100 + counter++).padStart(4, '0')}`;
    const hue = DEPARTMENT_HUES[node.department] ?? (counter * 37) % 360;
    const email = node.name.toLowerCase().replace(/\s+/g, '.') + '@perusahaan.co.id';
    const location = LOCATIONS[(counter * 7) % LOCATIONS.length] ?? 'Jakarta';

    const baseNode = {
      id,
      name: node.name,
      title: node.title,
      department: node.department,
      children: node.children ? node.children.map((child) => walk(child, newNode, level + 1)) : [],
      level,
      email,
      location,
      hue,
    };
    const newNode: OrgNode = {
      ...baseNode,
      parent: parentNode,
    };

    return newNode;
  }

  const root = walk(
    {
      name: 'Hendra Wijaya',
      title: 'Direktur Utama',
      department: 'Eksekutif',
      children: [
        {
          name: 'Maya Kusuma',
          title: 'Chief Technology Officer',
          department: 'Teknologi Informasi',
          children: [
            {
              name: 'Dewi Anggraini',
              title: 'Engineering Manager',
              department: 'Teknologi Informasi',
              children: [
                {
                  name: 'Rizky Pratama',
                  title: 'Senior Software Engineer',
                  department: 'Teknologi Informasi',
                },
                {
                  name: 'Bagas Saputra',
                  title: 'Software Engineer',
                  department: 'Teknologi Informasi',
                },
                { name: 'Nadia Fitriani', title: 'QA Engineer', department: 'Teknologi Informasi' },
              ],
            },
            {
              name: 'Fajar Nugroho',
              title: 'Infrastructure Lead',
              department: 'Teknologi Informasi',
              children: [
                {
                  name: 'Yoga Hidayat',
                  title: 'DevOps Engineer',
                  department: 'Teknologi Informasi',
                },
                {
                  name: 'Eko Santoso',
                  title: 'System Administrator',
                  department: 'Teknologi Informasi',
                },
              ],
            },
          ],
        },
        {
          name: 'Siti Rahayu',
          title: 'Chief Financial Officer',
          department: 'Keuangan',
          children: [
            {
              name: 'Andi Wijaya',
              title: 'Finance Manager',
              department: 'Keuangan',
              children: [
                { name: 'Intan Permata', title: 'Akuntan', department: 'Keuangan' },
                { name: 'Rama Putra', title: 'Analis Keuangan', department: 'Keuangan' },
              ],
            },
            { name: 'Lestari Kusuma', title: 'Tax Specialist', department: 'Keuangan' },
          ],
        },
        {
          name: 'Dimas Prakoso',
          title: 'Chief Operating Officer',
          department: 'Operasional',
          children: [
            {
              name: 'Citra Dewi',
              title: 'Logistics Manager',
              department: 'Operasional',
              children: [
                { name: 'Wulan Sari', title: 'Koordinator Logistik', department: 'Operasional' },
                { name: 'Arif Budiman', title: 'Staf Operasional', department: 'Operasional' },
              ],
            },
            {
              name: 'Joko Susilo',
              title: 'Procurement Manager',
              department: 'Pengadaan',
              children: [
                { name: 'Putri Amelia', title: 'Procurement Officer', department: 'Pengadaan' },
              ],
            },
          ],
        },
        {
          name: 'Ratna Sari',
          title: 'Chief Human Resources Officer',
          department: 'SDM',
          children: [
            { name: 'Anita Lestari', title: 'HR Business Partner', department: 'SDM' },
            { name: 'Budi Hartono', title: 'Payroll Specialist', department: 'SDM' },
            { name: 'Gita Maharani', title: 'Recruiter', department: 'SDM' },
          ],
        },
        {
          name: 'Laras Ayu',
          title: 'Chief Marketing Officer',
          department: 'Pemasaran',
          children: [
            {
              name: 'Tegar Pratama',
              title: 'Brand Manager',
              department: 'Pemasaran',
              children: [
                { name: 'Salsa Nabila', title: 'Content Specialist', department: 'Pemasaran' },
              ],
            },
          ],
        },
        {
          name: 'Hadi Gunawan',
          title: 'Head of Legal',
          department: 'Legal',
          children: [{ name: 'Mega Safitri', title: 'Compliance Analyst', department: 'Legal' }],
        },
      ],
    },
    null,
    0,
  );

  return { root, nodeMap };
}

/** Count total descendants. */
function countDescendants(node: OrgNode): number {
  return node.children.reduce((acc, child) => acc + 1 + countDescendants(child), 0);
}

/** Find a node by ID in the map. */
function findNode(nodeMap: Map<string, OrgNode>, id: string): OrgNode | null {
  return nodeMap.get(id) ?? null;
}

/** Get all nodes as flat array. */
function flattenNodes(root: OrgNode): OrgNode[] {
  const result: OrgNode[] = [root];
  for (const child of root.children) {
    result.push(...flattenNodes(child));
  }
  return result;
}

/** Render one node and its subtree. */
function Node({
  node,
  selectedId,
  highlightedId,
  openIds,
  onToggle,
  onSelect,
}: {
  node: OrgNode;
  selectedId: string | null;
  highlightedId: string | null;
  openIds: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const isSelected = selectedId === node.id;
  const isHighlighted = highlightedId === node.id;
  const hasChildren = node.children.length > 0;
  const isOpen = openIds.has(node.id);

  return (
    <li
      data-id={node.id}
      className={cn(!isOpen && hasChildren ? 'col' : '')}
      style={{ '--dh': node.hue } as React.CSSProperties}
    >
      <div
        className={cn('nd', isSelected && 'sel', isHighlighted && 'hit')}
        tabIndex={0}
        role="button"
        aria-label={`${node.name}, ${node.title}`}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(node.id);
          }
        }}
      >
        <img src={avatarDataUri(node.hue)} alt="" />
        <div>
          <b>{node.name}</b>
          <small>{node.title}</small>
          <em>{node.department}</em>
        </div>
        {hasChildren && (
          <button
            className="tg"
            aria-label={isOpen ? 'Tutup bawahan' : 'Buka bawahan'}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
          >
            {isOpen ? (
              <>
                <ChevronDown className="size-3.5" />
                {node.children.length}
              </>
            ) : (
              <>
                <ChevronRight className="size-3.5" />
                {node.children.length}
              </>
            )}
          </button>
        )}
      </div>
      {hasChildren && isOpen && (
        <ul>
          {node.children.map((child) => (
            <Node
              key={child.id}
              node={child}
              selectedId={selectedId}
              highlightedId={highlightedId}
              openIds={openIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Detail drawer for selected employee. */
function DetailDrawer({ node, onClose }: { node: OrgNode | null; onClose: () => void }) {
  if (!node) return null;

  const totalTeam = countDescendants(node);
  const parent = node.parent;

  return (
    <aside
      className="dr"
      aria-label="Detail karyawan"
      style={{ '--dh': node.hue } as React.CSSProperties}
    >
      <button className="x" aria-label="Tutup" onClick={onClose}>
        <X className="size-5" />
      </button>
      <img src={avatarDataUri(node.hue)} alt={`Foto ${node.name}`} />
      <h2>{node.name}</h2>
      <p className="t">{node.title}</p>
      <span
        className="bd"
        style={{ background: `hsl(${node.hue} 65% 90%)`, color: `hsl(${node.hue} 65% 35%)` }}
      >
        {node.department}
      </span>

      <dl className="kv">
        <div>
          <dt>ID Karyawan</dt>
          <dd>{node.id}</dd>
        </div>
        <div>
          <dt>Lokasi</dt>
          <dd>{node.location}</dd>
        </div>
        <div className="w">
          <dt>Email</dt>
          <dd>{node.email}</dd>
        </div>
        <div>
          <dt>Atasan</dt>
          <dd>
            {parent ? (
              <button
                className="lk"
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('org:go', { detail: parent.id }))
                }
              >
                {parent.name}
              </button>
            ) : (
              '–'
            )}
          </dd>
        </div>
        <div>
          <dt>Level</dt>
          <dd>Level {node.level + 1}</dd>
        </div>
        <div>
          <dt>Bawahan langsung</dt>
          <dd>{node.children.length}</dd>
        </div>
        <div>
          <dt>Total tim</dt>
          <dd>{totalTeam}</dd>
        </div>
      </dl>

      {node.children.length > 0 && (
        <>
          <h3>Bawahan langsung</h3>
          {node.children.map((child) => (
            <button
              key={child.id}
              className="pr"
              onClick={() => window.dispatchEvent(new CustomEvent('org:go', { detail: child.id }))}
            >
              <img src={avatarDataUri(child.hue)} alt="" />
              <span>
                <b>{child.name}</b>
                <small>{child.title}</small>
              </span>
            </button>
          ))}
        </>
      )}

      <div className="acts">
        <button
          className="btn"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('org:toast', { detail: `Pesan ke ${node.name} dibuat` }),
            )
          }
        >
          Kirim pesan
        </button>
        <button
          className="btn pri"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent('org:toast', { detail: `Membuka profil ${node.name}` }),
            )
          }
        >
          Lihat profil
        </button>
      </div>
    </aside>
  );
}

export function OrgChartNew() {
  const { toast } = useToast();
  const { root, nodeMap } = React.useMemo(() => buildDemoHierarchy(), []);
  const allNodes = React.useMemo(() => flattenNodes(root), [root]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [highlightedId, setHighlightedId] = React.useState<string | null>(null);
  const [openIds, setOpenIds] = React.useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const node of allNodes) {
      if (node.level < 2 && node.children.length > 0) {
        initial.add(node.id);
      }
    }
    return initial;
  });
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0, l: 0, t: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [deptFilter, setDeptFilter] = React.useState('');
  const vpRef = React.useRef<HTMLDivElement>(null);
  const stageRef = React.useRef<HTMLDivElement>(null);

  // Handle "go to node" events from drawer links
  React.useEffect(() => {
    const handleGo = (e: CustomEvent<string>) => {
      const node = findNode(nodeMap, e.detail);
      if (node) {
        // Open all ancestors
        let current: OrgNode | null = node.parent;
        while (current !== null) {
          const currentId = current.id;
          setOpenIds((prev) => new Set([...prev, currentId]));
          current = current.parent;
        }
        setSelectedId(node.id);
        setHighlightedId(node.id);
      }
    };
    window.addEventListener('org:go', handleGo as EventListener);
    return () => window.removeEventListener('org:go', handleGo as EventListener);
  }, [nodeMap]);

  // Handle toast events
  React.useEffect(() => {
    const handleToast = (e: CustomEvent<string>) => {
      toast({ title: e.detail, variant: 'info' });
    };
    window.addEventListener('org:toast', handleToast as EventListener);
    return () => window.removeEventListener('org:toast', handleToast as EventListener);
  }, [toast]);

  // Search & filter highlighting
  React.useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    const d = deptFilter;

    let firstMatch: OrgNode | null = null;
    for (const node of allNodes) {
      const nameTitle = `${node.name} ${node.title}`.toLowerCase();
      const hit = (!q || nameTitle.includes(q)) && (!d || node.department === d);
      if (hit && !firstMatch) firstMatch = node;
    }
    setHighlightedId(firstMatch?.id ?? null);

    if (firstMatch && q) {
      // Open ancestors
      let current: OrgNode | null = firstMatch.parent;
      while (current !== null) {
        const currentId = current.id;
        setOpenIds((prev) => new Set([...prev, currentId]));
        current = current.parent;
      }
    }
  }, [searchQuery, deptFilter, allNodes]);

  // Department list for filter
  const departments = React.useMemo(() => {
    const set = new Set<string>();
    for (const node of allNodes) set.add(node.department);
    return Array.from(set).sort();
  }, [allNodes]);

  const totalEmployees = allNodes.length;
  const totalDepartments = departments.length;
  const maxLevel = Math.max(...allNodes.map((n) => n.level)) + 1;

  const toggleNode = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openAll = () => {
    const next = new Set(openIds);
    for (const node of allNodes) {
      if (node.children.length > 0) next.add(node.id);
    }
    setOpenIds(next);
  };

  const closeAll = () => {
    const next = new Set(openIds);
    for (const node of allNodes) {
      if (node.children.length > 0 && node.level >= 1) next.delete(node.id);
    }
    setOpenIds(next);
  };

  const setZoomLevel = (z: number) => {
    const clamped = Math.max(0.4, Math.min(1.6, Math.round(z * 100) / 100));
    setZoom(clamped);
  };

  const zoomIn = () => setZoomLevel(zoom + 0.1);
  const zoomOut = () => setZoomLevel(zoom - 0.1);
  const zoomFit = () => {
    if (!stageRef.current || !vpRef.current) return;
    const stageWidth = stageRef.current.scrollWidth;
    const vpWidth = vpRef.current.clientWidth - 60;
    const newZoom = Math.min(1, vpWidth / stageWidth);
    setZoomLevel(newZoom);
    if (vpRef.current) vpRef.current.scrollLeft = 0;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoomLevel(zoom + (e.deltaY < 0 ? 0.08 : -0.08));
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target instanceof HTMLElement && e.target.closest('.nd'))) return;
    setPan({
      x: e.clientX,
      y: e.clientY,
      l: vpRef.current?.scrollLeft ?? 0,
      t: vpRef.current?.scrollTop ?? 0,
    });
    setIsPanning(true);
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPanning || !vpRef.current) return;
    vpRef.current.scrollLeft = pan.l - (e.clientX - pan.x);
    vpRef.current.scrollTop = pan.t - (e.clientY - pan.y);
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    setIsDragging(false);
  };

  // Center on first load
  React.useEffect(() => {
    if (vpRef.current) {
      vpRef.current.scrollLeft = (vpRef.current.scrollWidth - vpRef.current.clientWidth) / 2;
    }
  }, []);

  return (
    <div className="page">
      <div className="crumb">
        Karyawan › <b>Struktur Organisasi</b>
      </div>
      <div className="head">
        <div>
          <h1>Struktur Organisasi</h1>
          <p id="sub">
            {totalEmployees} karyawan · {totalDepartments} departemen · {maxLevel} level
          </p>
        </div>
        <button
          className="btn pri"
          onClick={() => toast({ title: 'Mengekspor bagan organisasi…', variant: 'info' })}
        >
          <svg className="i" viewBox="0 0 24 24">
            <path d="M12 4v11M7 11l5 5 5-5M5 20h14" />
          </svg>
          Ekspor bagan
        </button>
      </div>
      <section className="card">
        <div className="tool">
          <label className="search">
            <Search className="size-4" aria-hidden="true" />
            <input
              id="q"
              placeholder="Cari nama atau jabatan…"
              aria-label="Cari karyawan"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
          <select
            id="fd"
            aria-label="Sorot departemen"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="">Sorot departemen</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <span className="sp" />
          <button className="btn" id="oa" onClick={openAll}>
            Buka semua
          </button>
          <button className="btn" id="ca" onClick={closeAll}>
            Tutup semua
          </button>
          <div className="zm" role="group" aria-label="Zoom">
            <button id="zo" aria-label="Perkecil" onClick={zoomOut}>
              <Minus className="size-4" />
            </button>
            <span id="zl">{Math.round(zoom * 100)}%</span>
            <button id="zi" aria-label="Perbesar" onClick={zoomIn}>
              <Plus className="size-4" />
            </button>
            <button className="fit" id="zf" onClick={zoomFit}>
              <Maximize className="size-3.5" /> Sesuaikan
            </button>
          </div>
        </div>
        <div className="leg" id="leg">
          {departments.map((d) => (
            <span key={d} style={{ '--dh': DEPARTMENT_HUES[d] ?? 0 } as React.CSSProperties}>
              <i
                style={
                  { background: `hsl(${DEPARTMENT_HUES[d] ?? 0} 65% 44%)` } as React.CSSProperties
                }
              />
              {d} ({allNodes.filter((n) => n.department === d).length})
            </span>
          ))}
        </div>
        <div
          className={cn('vp', isDragging && 'dg')}
          id="vp"
          ref={vpRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <div
            className="stage"
            id="st"
            ref={stageRef}
            style={{ '--z': zoom } as React.CSSProperties}
          >
            <div className="tree" id="tr">
              <ul>
                <Node
                  node={root}
                  selectedId={selectedId}
                  highlightedId={highlightedId}
                  openIds={openIds}
                  onToggle={toggleNode}
                  onSelect={setSelectedId}
                />
              </ul>
            </div>
          </div>
        </div>
      </section>
      <DetailDrawer
        node={selectedId ? findNode(nodeMap, selectedId) : null}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
